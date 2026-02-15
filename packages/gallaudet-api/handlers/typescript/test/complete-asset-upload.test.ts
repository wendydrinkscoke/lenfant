process.env.ASSETS_BUCKET_NAME = 'asset-bucket';
process.env.ASSET_UPLOADS_TABLE_NAME = 'AssetUploads';
process.env.ASSETS_TABLE_NAME = 'Assets';

import {
  CompleteAssetUploadChainedRequestInput,
  BadRequestErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { completeAssetUpload } from '../src/complete-asset-upload';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const getPromise = jest.fn();
  const putPromise = jest.fn();
  const deletePromise = jest.fn();
  const get = jest.fn(() => ({ promise: getPromise }));
  const put = jest.fn(() => ({ promise: putPromise }));
  const deleteFn = jest.fn(() => ({ promise: deletePromise }));

  const completeMultipartUploadPromise = jest.fn();
  const completeMultipartUpload = jest.fn(() => ({ promise: completeMultipartUploadPromise }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get,
        put,
        delete: deleteFn,
      })),
    },
    S3: jest.fn(() => ({
      completeMultipartUpload,
    })),
    __mocks: {
      dynamo: {
        get,
        getPromise,
        put,
        putPromise,
        deleteFn,
        deletePromise,
      },
      s3: {
        completeMultipartUpload,
        completeMultipartUploadPromise,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks, s3: s3Mocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: {
      get: jest.Mock;
      getPromise: jest.Mock;
      put: jest.Mock;
      putPromise: jest.Mock;
      deleteFn: jest.Mock;
      deletePromise: jest.Mock;
    };
    s3: {
      completeMultipartUpload: jest.Mock;
      completeMultipartUploadPromise: jest.Mock;
    };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;

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
} satisfies Omit<CompleteAssetUploadChainedRequestInput, 'input'>;

const buildSinglePartRequest = () => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId: '1234567890',
      uploadSessionId: 'session-123',
    },
    body: {
      completion: {
        singlePart: {
          eTag: 'etag-123',
        },
      },
    },
  },
});

describe('CompleteAssetUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        UploadSessionId: 'session-123',
        AssetId: 'asset-123',
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
        FileName: 'banner.gif',
        ContentType: 'image/gif',
        SizeBytes: 1024,
        ObjectKey: '1234567890/asset-123/banner.gif',
        Strategy: 'single-part-put',
        CreatedAt: 1700000000,
      },
    });
    dynamoMocks.putPromise.mockResolvedValue({});
    dynamoMocks.deletePromise.mockResolvedValue({});
    s3Mocks.completeMultipartUploadPromise.mockResolvedValue({});
  });

  it('completes a single-part upload and returns an asset record', async () => {
    const response = await completeAssetUpload(buildSinglePartRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      asset: {
        assetId: 'asset-123',
        experienceId: '1234567890',
        fileName: 'banner.gif',
        contentType: 'image/gif',
        sizeBytes: 1024,
        objectKey: '1234567890/asset-123/banner.gif',
        status: 'ready',
        createdAt: 1700000000,
        updatedAt: expect.any(Number),
      },
    });
    expect(dynamoMocks.put).toHaveBeenCalled();
    expect(dynamoMocks.deleteFn).toHaveBeenCalledWith({
      TableName: 'AssetUploads',
      Key: {
        UploadSessionId: 'session-123',
      },
    });
    expect(s3Mocks.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('completes a multipart upload when multipart completion details are provided', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        UploadSessionId: 'session-123',
        AssetId: 'asset-123',
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
        FileName: 'banner.gif',
        ContentType: 'image/gif',
        SizeBytes: 1024,
        ObjectKey: '1234567890/asset-123/banner.gif',
        Strategy: 'multipart-put',
        MultipartUploadId: 'upload-id-123',
        CreatedAt: 1700000000,
      },
    });

    const response = await completeAssetUpload({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: '1234567890',
          uploadSessionId: 'session-123',
        },
        body: {
          completion: {
            multipart: {
              parts: [
                { partNumber: 2, eTag: 'etag-b' },
                { partNumber: 1, eTag: 'etag-a' },
              ],
            },
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(s3Mocks.completeMultipartUpload).toHaveBeenCalledWith({
      Bucket: 'asset-bucket',
      Key: '1234567890/asset-123/banner.gif',
      UploadId: 'upload-id-123',
      MultipartUpload: {
        Parts: [
          { ETag: 'etag-a', PartNumber: 1 },
          { ETag: 'etag-b', PartNumber: 2 },
        ],
      },
    });
  });

  it('returns bad request when both singlePart and multipart payloads are provided', async () => {
    const response = await completeAssetUpload({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: '1234567890',
          uploadSessionId: 'session-123',
        },
        body: {
          completion: {
            singlePart: { eTag: 'etag-1' },
            multipart: { parts: [{ partNumber: 1, eTag: 'etag-2' }] },
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'completion must include exactly one of singlePart or multipart',
    );
  });
});
