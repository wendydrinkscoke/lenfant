process.env.PROJECTS_TABLE_NAME = 'Projects';

import {
  BadRequestErrorResponseContent,
  CreateProjectChainedRequestInput,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  ProjectAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { createProject } from '../src/create-project';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const put = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({ put })),
    },
    __mocks: {
      dynamo: {
        put,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: { put: jest.Mock };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;
const fetchMock = jest.fn();
const COGNITO_USER_ID = '645824d8-c0a1-7069-1dff-77e1e7862617';
const EXISTING_EXPERIENCE_ID = '9228429469';
const NEW_EXPERIENCE_ID = '9441750099';
const PLACE_ID = '127120714583972';

const buildFetchResponse = (status = 200, body: unknown = { universeId: null }) => ({
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
    fetchMock.mockResolvedValue(buildFetchResponse(200, { universeId: null }));
    mockedGetCognitoUserIdFromEvent.mockReturnValue(COGNITO_USER_ID);
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
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
    expect(dynamoMocks.put).not.toHaveBeenCalled();
  });

  it('creates a project scoped to the calling Cognito user', async () => {
    const response = await createProject(buildRequest(NEW_EXPERIENCE_ID));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Project created successfully.',
    });
    expect(dynamoMocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'Projects',
        ConditionExpression:
          'attribute_not_exists(CognitoUserId) AND attribute_not_exists(ExperienceId)',
        Item: expect.objectContaining({
          CognitoUserId: COGNITO_USER_ID,
          ExperienceId: NEW_EXPERIENCE_ID,
          CreatedAt: expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `https://apis.roblox.com/universes/v1/places/${NEW_EXPERIENCE_ID}/universe`,
    );
  });

  it('returns bad request when a place id is provided and suggests the universe id', async () => {
    fetchMock.mockResolvedValue(
      buildFetchResponse(200, { universeId: 9228429469 }),
    );

    const response = await createProject(buildRequest(PLACE_ID));

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toContain(
      'appears to be a Roblox place ID',
    );
    expect((response.body as BadRequestErrorResponseContent).message).toContain(
      '9228429469',
    );
    expect(dynamoMocks.put).not.toHaveBeenCalled();
  });

  it('returns bad request for non-numeric identifiers', async () => {
    const response = await createProject(buildRequest('abc123'));

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'Experience ID must contain only numbers.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dynamoMocks.put).not.toHaveBeenCalled();
  });

  it('returns internal failure when Roblox validation fails', async () => {
    fetchMock.mockResolvedValue(buildFetchResponse(500, { message: 'error' }));

    const response = await createProject(buildRequest(NEW_EXPERIENCE_ID));

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to validate experience ID with Roblox.',
    );
    expect(dynamoMocks.put).not.toHaveBeenCalled();
  });

  it('returns a conflict when the user already created a project for the experience', async () => {
    const conditionalCheckFailedError = Object.assign(
      new Error('Conditional request failed'),
      { code: 'ConditionalCheckFailedException' },
    );
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockRejectedValue(conditionalCheckFailedError),
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(409);
    expect(
      (response.body as ProjectAlreadyExistsErrorResponseContent).message,
    ).toEqual(
      `A project for experienceId ${EXISTING_EXPERIENCE_ID} already exists for this user.`,
    );
  });

  it('returns internal failure when the project write fails', async () => {
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('ddb error')),
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual(
      'Failed to create new project entry in the database.',
    );
  });
});
