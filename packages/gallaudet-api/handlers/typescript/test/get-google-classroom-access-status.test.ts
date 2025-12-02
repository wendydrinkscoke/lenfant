process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';

import {
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  GetGoogleClassroomAccessStatusChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import {
  getGoogleClassroomAccessStatus,
} from '../src/get-google-classroom-access-status';

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
} satisfies Omit<GetGoogleClassroomAccessStatusChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  dynamoMocks.getPromise.mockResolvedValue({
    Item: undefined,
  });
});

describe('GetGoogleClassroomAccessStatus', () => {

  it('returns delegated true when a refresh token exists', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        CognitoUserId: 'cognito-user-123',
        Provider: 'google',
        RefreshToken: 'refresh-token',
      },
    });

    const response = await getGoogleClassroomAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(dynamoMocks.get).toHaveBeenCalledWith({
      TableName: 'OAuthTokens',
      Key: {
        CognitoUserId: 'cognito-user-123',
        Provider: 'google',
      },
      ConsistentRead: true,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      delegated: true,
    });
  });

  it('returns delegated false when no refresh token exists', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        CognitoUserId: 'cognito-user-123',
        Provider: 'google',
      },
    });

    const response = await getGoogleClassroomAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      delegated: false,
    });
  });

  it('returns delegated false when no token record exists', async () => {
    const response = await getGoogleClassroomAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      delegated: false,
    });
  });

  it('returns 403 when the user is not authenticated', async () => {
    const response = await getGoogleClassroomAccessStatus({
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

    const response = await getGoogleClassroomAccessStatus({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to fetch Google Classroom access status',
    );
  });
});
