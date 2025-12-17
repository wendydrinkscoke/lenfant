process.env.ROBLOX_API_KEY_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret';
process.env.PROJECTS_TABLE_NAME = 'Projects';
process.env.USERS_TABLE_NAME = 'Users';

import {
  CreateProjectChainedRequestInput,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  RobloxLinkRequiredErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { createProject } from '../src/create-project';
import { getCognitoUserIdFromEvent, getRobloxUserIdForCognitoUser } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
  getRobloxUserIdForCognitoUser: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const getSecretValue = jest.fn();
  const put = jest.fn();
  return {
    SecretsManager: jest.fn(() => ({ getSecretValue })),
    DynamoDB: {
      DocumentClient: jest.fn(() => ({ put })),
    },
    __mocks: {
      secrets: {
        getSecretValue,
      },
      dynamo: {
        put,
      },
    },
  };
});

const {
  __mocks: { secrets: secretsMocks, dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    secrets: { getSecretValue: jest.Mock };
    dynamo: { put: jest.Mock };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;
const mockedGetRobloxUserIdForCognitoUser = getRobloxUserIdForCognitoUser as jest.Mock;

const fetchMock = jest.fn();

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

const buildRequest = (experienceId = '1234567890') => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId,
    },
    body: undefined as never,
  },
});

const buildFetchResponse = (data: unknown, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(data),
});

describe('CreateProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as typeof globalThis & { fetch: jest.Mock }).fetch = fetchMock;
    fetchMock.mockReset();

    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    mockedGetRobloxUserIdForCognitoUser.mockResolvedValue('123');

    secretsMocks.getSecretValue.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        SecretString: 'roblox-api-key-12345',
      }),
    });

    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
  });

  it('returns not authorized when no Roblox account is linked', async () => {
    const notLinkedError = Object.assign(new Error('No Roblox user id'), {
      name: 'RobloxUserNotLinkedError',
    });
    mockedGetRobloxUserIdForCognitoUser.mockRejectedValue(notLinkedError);

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as RobloxLinkRequiredErrorResponseContent).message).toEqual(
      'No Roblox User ID linked to Cognito user ID: cognito-user-123.',
    );
    expect(secretsMocks.getSecretValue).not.toHaveBeenCalled();
  });

  it('returns internal failure when secret retrieval fails', async () => {
    secretsMocks.getSecretValue.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('boom')),
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to retrieve the Google OAuth client secret',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns internal failure when Roblox universe lookup fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to retrieve metadata for the specified universe from Roblox.',
    );
  });

  it('returns internal failure when group metadata lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse({ group: 'groups/456' }))
      .mockResolvedValueOnce({ ok: false });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to retrieve metadata for the owning group from Roblox.',
    );
  });

  it('returns not authorized when the user does not own the universe', async () => {
    fetchMock.mockResolvedValueOnce(buildFetchResponse({ user: 'users/999' }));

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      "The caller's associated Roblox account (ID: 123) does not own the the experience with ID 1234567890. Please reach out to the owner (ID: 999).",
    );
    expect(dynamoMocks.put).not.toHaveBeenCalled();
  });

  it('creates a project when the user owns the universe', async () => {
    fetchMock.mockResolvedValueOnce(buildFetchResponse({ user: 'users/123' }));

    const response = await createProject(buildRequest('9876543210'));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Project created successfully.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://apis.roblox.com/cloud/v2/universes/9876543210',
      {
        method: 'GET',
        headers: {
          'x-api-key': 'roblox-api-key-12345',
        },
      },
    );
    expect(dynamoMocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'Projects',
        ConditionExpression: 'attribute_not_exists(ExperienceId)',
        Item: expect.objectContaining({
          ExperienceId: '9876543210',
          ProjectCreatorRobloxUserId: '123',
          CreatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('creates a project when the group owner matches the caller', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse({ group: 'groups/222' }))
      .mockResolvedValueOnce(buildFetchResponse({ owner: { userId: 123 } }));

    const response = await createProject(buildRequest('2223334444'));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Project created successfully.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://groups.roblox.com/v1/groups/222',
      { method: 'GET' },
    );
  });

  it('returns internal failure when the project write fails', async () => {
    fetchMock.mockResolvedValueOnce(buildFetchResponse({ user: 'users/123' }));
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('ddb error')),
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to create new project entry in the database.',
    );
  });
});
