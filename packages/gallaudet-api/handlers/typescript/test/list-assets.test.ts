process.env.ASSETS_TABLE_NAME = 'Assets';

import {
  BadRequestErrorResponseContent,
  InternalFailureErrorResponseContent,
  ListAssetsChainedRequestInput,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { listAssets } from '../src/list-assets';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const queryPromise = jest.fn();
  const query = jest.fn(() => ({ promise: queryPromise }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query,
      })),
    },
    __mocks: {
      dynamo: {
        query,
        queryPromise,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: {
      query: jest.Mock;
      queryPromise: jest.Mock;
    };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;

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
} satisfies Omit<ListAssetsChainedRequestInput, 'input'>;

const buildRequest = (experienceId = '1234567890') => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId,
    },
    body: {} as never,
  },
});

describe('ListAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.queryPromise.mockResolvedValue({
      Items: [],
    });
  });

  it('returns 403 when no authenticated user is found', async () => {
    mockedGetCognitoUserIdFromEvent.mockImplementation(() => {
      throw new Error('Cognito User ID not parseable from event.');
    });

    const response = await listAssets(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Authentication required',
    );
    expect(dynamoMocks.query).not.toHaveBeenCalled();
  });

  it('returns 400 when experienceId is missing', async () => {
    const response = await listAssets(buildRequest('   '));

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'experienceId is required',
    );
    expect(dynamoMocks.query).not.toHaveBeenCalled();
  });

  it('returns assets scoped to the project and sorted by recency', async () => {
    dynamoMocks.queryPromise
      .mockResolvedValueOnce({
        Items: [
          {
            AssetId: 'asset-older',
            CognitoUserId: 'cognito-user-123',
            ExperienceId: '1234567890',
            FileName: 'older.gif',
            ContentType: 'image/gif',
            SizeBytes: 1024,
            ObjectKey: 'cognito-user-123/1234567890/asset-older/older.gif',
            Status: 'ready',
            CreatedAt: 1700000000,
            UpdatedAt: 1700000050,
          },
        ],
        LastEvaluatedKey: {
          AssetId: 'asset-older',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            AssetId: 'asset-newer',
            CognitoUserId: 'cognito-user-123',
            ExperienceId: '1234567890',
            FileName: 'newer.gif',
            ContentType: 'image/gif',
            SizeBytes: 2048,
            ObjectKey: 'cognito-user-123/1234567890/asset-newer/newer.gif',
            Status: 'ready',
            CreatedAt: 1700000001,
            UpdatedAt: 1700000100,
          },
          {
            AssetId: 'asset-invalid',
            CognitoUserId: 'cognito-user-123',
            ExperienceId: '1234567890',
            FileName: 'invalid.gif',
            ContentType: 'image/tiff',
            SizeBytes: 2048,
            ObjectKey: 'cognito-user-123/1234567890/asset-invalid/invalid.gif',
            Status: 'ready',
            CreatedAt: 1700000002,
            UpdatedAt: 1700000200,
          },
        ],
      });

    const response = await listAssets(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      assets: [
        {
          assetId: 'asset-newer',
          experienceId: '1234567890',
          fileName: 'newer.gif',
          contentType: 'image/gif',
          sizeBytes: 2048,
          objectKey: 'cognito-user-123/1234567890/asset-newer/newer.gif',
          status: 'ready',
          createdAt: 1700000001,
          updatedAt: 1700000100,
        },
        {
          assetId: 'asset-older',
          experienceId: '1234567890',
          fileName: 'older.gif',
          contentType: 'image/gif',
          sizeBytes: 1024,
          objectKey: 'cognito-user-123/1234567890/asset-older/older.gif',
          status: 'ready',
          createdAt: 1700000000,
          updatedAt: 1700000050,
        },
      ],
    });

    expect(dynamoMocks.query).toHaveBeenNthCalledWith(1, {
      TableName: 'Assets',
      IndexName: 'CognitoUserIdExperienceIdIndex',
      KeyConditionExpression:
        '#cognitoUserId = :cognitoUserId AND #experienceId = :experienceId',
      ExpressionAttributeNames: {
        '#cognitoUserId': 'CognitoUserId',
        '#experienceId': 'ExperienceId',
      },
      ExpressionAttributeValues: {
        ':cognitoUserId': 'cognito-user-123',
        ':experienceId': '1234567890',
      },
      ExclusiveStartKey: undefined,
    });
    expect(dynamoMocks.query).toHaveBeenNthCalledWith(2, {
      TableName: 'Assets',
      IndexName: 'CognitoUserIdExperienceIdIndex',
      KeyConditionExpression:
        '#cognitoUserId = :cognitoUserId AND #experienceId = :experienceId',
      ExpressionAttributeNames: {
        '#cognitoUserId': 'CognitoUserId',
        '#experienceId': 'ExperienceId',
      },
      ExpressionAttributeValues: {
        ':cognitoUserId': 'cognito-user-123',
        ':experienceId': '1234567890',
      },
      ExclusiveStartKey: {
        AssetId: 'asset-older',
      },
    });
  });

  it('returns 500 when the assets query fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
      message: 'Throughput exceeded',
    });
    dynamoMocks.queryPromise.mockRejectedValueOnce(dynamoError);

    const response = await listAssets(buildRequest());

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to list assets.',
    );
  });
});
