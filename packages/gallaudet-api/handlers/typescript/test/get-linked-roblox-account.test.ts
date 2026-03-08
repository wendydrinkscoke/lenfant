process.env.USERS_TABLE_NAME = 'Users';

import {
  InternalFailureErrorResponseContent,
  BadRequestErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  GetLinkedRobloxAccountChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import {
  getLinkedRobloxAccount,
} from '../src/get-linked-roblox-account';

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

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
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
} satisfies Omit<GetLinkedRobloxAccountChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  dynamoMocks.getPromise.mockResolvedValue({
    Item: undefined,
  });
});

describe('GetLinkedRobloxAccount', () => {

  it('returns the linked Roblox user id for the authenticated Cognito user', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
        RobloxUserId: '7954006733',
      },
    });

    const response = await getLinkedRobloxAccount({
      ...requestArguments,
      input: {
        requestParameters: {} as any,
        body: undefined as never,
      },
    });

    expect(dynamoMocks.get).toHaveBeenCalledWith({
      TableName: 'Users',
      Key: { CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4' },
      ConsistentRead: true,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      robloxUserId: '7954006733',
    });
  });

  it('returns 400 when no Roblox account is linked', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
      },
    });

    const response = await getLinkedRobloxAccount({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'Roblox account not linked',
    );
  });

  it('returns 403 when no authenticated user can be resolved', async () => {
    const response = await getLinkedRobloxAccount({
      ...requestArguments,
      event: { requestContext: {} } as any,
      input: {
        requestParameters: {},
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

    const response = await getLinkedRobloxAccount({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to fetch linked Roblox account',
    );
  });
});
