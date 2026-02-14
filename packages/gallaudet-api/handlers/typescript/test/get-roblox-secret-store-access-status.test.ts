process.env.ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME = 'RobloxExperienceApiKeys';

import {
  BadRequestErrorResponseContent,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  GetRobloxSecretStoreAccessStatusChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import { getRobloxSecretStoreAccessStatus } from '../src/get-roblox-secret-store-access-status';

jest.mock('aws-sdk', () => {
  const getPromise = jest.fn();
  const get = jest.fn(() => ({
    promise: getPromise,
  }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get,
      })),
    },
    __mocks: {
      dynamo: {
        get,
        getPromise,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: {
      get: jest.Mock;
      getPromise: jest.Mock;
    };
  };
};

const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: 'cognito-user-123',
        },
      },
    },
  } as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
} satisfies Omit<GetRobloxSecretStoreAccessStatusChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  dynamoMocks.getPromise.mockResolvedValue({
    Item: undefined,
  });
});

describe('GetRobloxSecretStoreAccessStatus', () => {
  it('returns delegated true when an API key exists for the user and experience', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
        ApiKey: 'rbx-api-key',
      },
    });

    const response = await getRobloxSecretStoreAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: '1234567890',
        },
        body: undefined as never,
      },
    });

    expect(dynamoMocks.get).toHaveBeenCalledWith({
      TableName: 'RobloxExperienceApiKeys',
      Key: {
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
      },
      ConsistentRead: true,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      delegated: true,
    });
  });

  it('returns delegated false when no stored API key exists', async () => {
    const response = await getRobloxSecretStoreAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: '1234567890',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      delegated: false,
    });
  });

  it('returns delegated false when API key is blank', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
        ApiKey: '   ',
      },
    });

    const response = await getRobloxSecretStoreAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: '1234567890',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      delegated: false,
    });
  });

  it('returns 400 when experienceId is missing', async () => {
    const response = await getRobloxSecretStoreAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: undefined as any,
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'experienceId is required',
    );
    expect(dynamoMocks.get).not.toHaveBeenCalled();
  });

  it('returns 403 when the user is not authenticated', async () => {
    const response = await getRobloxSecretStoreAccessStatus({
      ...requestArguments,
      event: { requestContext: {} } as any,
      input: {
        requestParameters: {
          experienceId: '1234567890',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Authentication required',
    );
    expect(dynamoMocks.get).not.toHaveBeenCalled();
  });

  it('returns 500 when DynamoDB get fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
      message: 'Throughput exceeded',
    });
    dynamoMocks.getPromise.mockRejectedValueOnce(dynamoError);

    const response = await getRobloxSecretStoreAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: '1234567890',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to fetch Roblox secret store access status',
    );
  });
});
