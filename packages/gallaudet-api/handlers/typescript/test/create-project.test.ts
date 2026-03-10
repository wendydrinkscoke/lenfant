process.env.PROJECTS_TABLE_NAME = 'Projects';
process.env.EXPERIENCES_TABLE_NAME = 'Experiences';

import {
  BadRequestErrorResponseContent,
  CreateProjectChainedRequestInput,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  PlaceIdProvidedErrorResponseContent,
  ProjectAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { createProject } from '../src/create-project';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const transactWritePromise = jest.fn();
  const transactWrite = jest.fn(() => ({
    promise: transactWritePromise,
  }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({ transactWrite })),
    },
    __mocks: {
      dynamo: {
        transactWrite,
        transactWritePromise,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: {
      transactWrite: jest.Mock;
      transactWritePromise: jest.Mock;
    };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;
const fetchMock = jest.fn();
const COGNITO_USER_ID = '645824d8-c0a1-7069-1dff-77e1e7862617';
const EXISTING_EXPERIENCE_ID = '9228429469';
const NEW_EXPERIENCE_ID = '9441750099';
const PLACE_ID = '127120714583972';

const buildFetchResponse = (status = 200, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(
    typeof body === 'string' ? body : JSON.stringify(body),
  ),
});

const requestArguments = {
  chain: undefined as never,
  event: {} as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
} satisfies Omit<CreateProjectChainedRequestInput, 'input'>;

const buildRequest = (experienceId = EXISTING_EXPERIENCE_ID) => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId,
    },
    body: undefined as never,
  },
});

describe('CreateProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as typeof globalThis & { fetch: jest.Mock }).fetch = fetchMock;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      buildFetchResponse(200, {
        data: [
          {
            id: Number(EXISTING_EXPERIENCE_ID),
            name: 'National USA Game',
          },
        ],
      }),
    );
    mockedGetCognitoUserIdFromEvent.mockReturnValue(COGNITO_USER_ID);
    dynamoMocks.transactWritePromise.mockResolvedValue({});
  });

  it('returns not authorized when no authenticated user is present', async () => {
    mockedGetCognitoUserIdFromEvent.mockImplementation(() => {
      throw new Error('Cognito User ID not parseable from event.');
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Authentication required',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dynamoMocks.transactWrite).not.toHaveBeenCalled();
  });

  it('creates a project scoped to the calling Cognito user', async () => {
    fetchMock.mockResolvedValueOnce(
      buildFetchResponse(200, {
        data: [
          {
            id: Number(NEW_EXPERIENCE_ID),
            name: 'Fresh Universe',
          },
        ],
      }),
    );

    const response = await createProject(buildRequest(NEW_EXPERIENCE_ID));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Project created successfully.',
    });
    expect(dynamoMocks.transactWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactItems: [
          {
            Put: {
              TableName: 'Projects',
              ConditionExpression:
                'attribute_not_exists(CognitoUserId) AND attribute_not_exists(ExperienceId)',
              Item: expect.objectContaining({
                CognitoUserId: COGNITO_USER_ID,
                ExperienceId: NEW_EXPERIENCE_ID,
                CreatedAt: expect.any(String),
              }),
            },
          },
          {
            Update: {
              TableName: 'Experiences',
              Key: {
                ExperienceId: NEW_EXPERIENCE_ID,
              },
              UpdateExpression: expect.stringContaining('#experienceName = :experienceName'),
              ExpressionAttributeNames: expect.objectContaining({
                '#experienceName': 'ExperienceName',
                '#experienceNameFetchedAt': 'ExperienceNameFetchedAt',
              }),
              ExpressionAttributeValues: expect.objectContaining({
                ':experienceName': 'Fresh Universe',
                ':experienceNameFetchedAt': expect.any(String),
              }),
            },
          },
        ],
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `https://games.roblox.com/v1/games?universeIds=${NEW_EXPERIENCE_ID}`,
    );
  });

  it('returns bad request when a place id is provided and suggests the universe id', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse(200, { data: [] }))
      .mockResolvedValueOnce(
        buildFetchResponse(200, { universeId: 9228429469 }),
      );

    const response = await createProject(buildRequest(PLACE_ID));

    expect(response.statusCode).toBe(422);
    expect((response.body as PlaceIdProvidedErrorResponseContent).message).toContain(
      'appears to be a Roblox place ID',
    );
    expect((response.body as PlaceIdProvidedErrorResponseContent).message).toContain(
      '9228429469',
    );
    expect(
      (response.body as PlaceIdProvidedErrorResponseContent).suggestedUniverseId,
    ).toBe('9228429469');
    expect(dynamoMocks.transactWrite).not.toHaveBeenCalled();
  });

  it('returns bad request for non-numeric identifiers', async () => {
    const response = await createProject(buildRequest('abc123'));

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'Experience ID must contain only numbers.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dynamoMocks.transactWrite).not.toHaveBeenCalled();
  });

  it('returns bad request when the identifier is neither a universe ID nor a place ID', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse(200, { data: [] }))
      .mockResolvedValueOnce(buildFetchResponse(404, { errors: [] }));

    const response = await createProject(buildRequest('123'));

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'Experience ID 123 does not correspond to a valid Roblox universe.',
    );
    expect(dynamoMocks.transactWrite).not.toHaveBeenCalled();
  });

  it('returns internal failure when Roblox validation fails', async () => {
    fetchMock.mockResolvedValueOnce(buildFetchResponse(500, { message: 'error' }));

    const response = await createProject(buildRequest(NEW_EXPERIENCE_ID));

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to validate experience ID with Roblox.',
    );
    expect(dynamoMocks.transactWrite).not.toHaveBeenCalled();
  });

  it('returns a conflict when the user already created a project for the experience', async () => {
    const transactionCanceledError = Object.assign(
      new Error('Transaction cancelled due to ConditionalCheckFailed'),
      {
        code: 'TransactionCanceledException',
        cancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
      },
    );
    dynamoMocks.transactWritePromise.mockRejectedValueOnce(transactionCanceledError);

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(409);
    expect(
      (response.body as ProjectAlreadyExistsErrorResponseContent).message,
    ).toEqual(
      `A project for experienceId ${EXISTING_EXPERIENCE_ID} already exists for this user.`,
    );
  });

  it('returns internal failure when the project write fails', async () => {
    dynamoMocks.transactWritePromise.mockRejectedValueOnce(new Error('ddb error'));

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual(
      'Failed to create new project entry in the database.',
    );
  });
});
