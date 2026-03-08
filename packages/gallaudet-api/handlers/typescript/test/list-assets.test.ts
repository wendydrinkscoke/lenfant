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
} satisfies Omit<ListAssetsChainedRequestInput, 'input'>;

const buildRequest = (experienceId = '9228429469') => ({
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
    mockedGetCognitoUserIdFromEvent.mockReturnValue('3448c4d8-70e1-703a-6450-fbf81e4d71b4');
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
            AssetId: 'dd4465a8-4f2f-4f19-8ab8-98aa1257ceeb',
            CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
            ExperienceId: '9228429469',
            FileName: 'larger-gif.gif',
            ContentType: 'image/gif',
            SizeBytes: 10988203,
            ObjectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/dd4465a8-4f2f-4f19-8ab8-98aa1257ceeb/larger-gif.gif',
            Status: 'ready',
            CreatedAt: 1771152724,
            UpdatedAt: 1771152730,
          },
          {
            AssetId: '3a3573f1-1312-4f1f-9bed-9973b159dbcd',
            CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
            ExperienceId: '9228429469',
            FileName: 'paintball.gif',
            ContentType: 'image/gif',
            SizeBytes: 2440489,
            ObjectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/3a3573f1-1312-4f1f-9bed-9973b159dbcd/paintball.gif',
            Status: 'ready',
            CreatedAt: 1771152457,
            UpdatedAt: 1771152460,
          },
        ],
        LastEvaluatedKey: {
          AssetId: '3a3573f1-1312-4f1f-9bed-9973b159dbcd',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            AssetId: '3d19eaa3-41bc-416c-9c5e-08641af191f7',
            CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
            ExperienceId: '9228429469',
            FileName: 'adfasdf.png',
            ContentType: 'image/png',
            SizeBytes: 16927656,
            ObjectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/3d19eaa3-41bc-416c-9c5e-08641af191f7/adfasdf.png',
            Status: 'ready',
            CreatedAt: 1772964578,
            UpdatedAt: 1772964585,
          },
          {
            AssetId: '1919b0d6-be31-4f6f-8afe-1d97f8c3f60a',
            CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
            ExperienceId: '9228429469',
            FileName: 'big-image.png',
            ContentType: 'image/png',
            SizeBytes: 16927656,
            ObjectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/1919b0d6-be31-4f6f-8afe-1d97f8c3f60a/big-image.png',
            Status: 'ready',
            CreatedAt: 1772964874,
            UpdatedAt: 1772964878,
          },
        ],
      });

    const response = await listAssets(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      assets: [
        {
          assetId: '1919b0d6-be31-4f6f-8afe-1d97f8c3f60a',
          experienceId: '9228429469',
          fileName: 'big-image.png',
          contentType: 'image/png',
          sizeBytes: 16927656,
          objectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/1919b0d6-be31-4f6f-8afe-1d97f8c3f60a/big-image.png',
          status: 'ready',
          createdAt: 1772964874,
          updatedAt: 1772964878,
        },
        {
          assetId: '3d19eaa3-41bc-416c-9c5e-08641af191f7',
          experienceId: '9228429469',
          fileName: 'adfasdf.png',
          contentType: 'image/png',
          sizeBytes: 16927656,
          objectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/3d19eaa3-41bc-416c-9c5e-08641af191f7/adfasdf.png',
          status: 'ready',
          createdAt: 1772964578,
          updatedAt: 1772964585,
        },
        {
          assetId: 'dd4465a8-4f2f-4f19-8ab8-98aa1257ceeb',
          experienceId: '9228429469',
          fileName: 'larger-gif.gif',
          contentType: 'image/gif',
          sizeBytes: 10988203,
          objectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/dd4465a8-4f2f-4f19-8ab8-98aa1257ceeb/larger-gif.gif',
          status: 'ready',
          createdAt: 1771152724,
          updatedAt: 1771152730,
        },
        {
          assetId: '3a3573f1-1312-4f1f-9bed-9973b159dbcd',
          experienceId: '9228429469',
          fileName: 'paintball.gif',
          contentType: 'image/gif',
          sizeBytes: 2440489,
          objectKey: '3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/3a3573f1-1312-4f1f-9bed-9973b159dbcd/paintball.gif',
          status: 'ready',
          createdAt: 1771152457,
          updatedAt: 1771152460,
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
        ':cognitoUserId': '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
        ':experienceId': '9228429469',
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
        ':cognitoUserId': '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
        ':experienceId': '9228429469',
      },
      ExclusiveStartKey: {
        AssetId: '3a3573f1-1312-4f1f-9bed-9973b159dbcd',
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
