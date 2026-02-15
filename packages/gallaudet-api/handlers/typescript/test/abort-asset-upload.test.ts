process.env.ASSETS_BUCKET_NAME = 'asset-bucket';
process.env.ASSET_UPLOADS_TABLE_NAME = 'AssetUploads';

import {
  AbortAssetUploadChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import { abortAssetUpload } from '../src/abort-asset-upload';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const getPromise = jest.fn();
  const deletePromise = jest.fn();
  const get = jest.fn(() => ({ promise: getPromise }));
  const deleteFn = jest.fn(() => ({ promise: deletePromise }));

  const abortMultipartUploadPromise = jest.fn();
  const abortMultipartUpload = jest.fn(() => ({ promise: abortMultipartUploadPromise }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get,
        delete: deleteFn,
      })),
    },
    S3: jest.fn(() => ({
      abortMultipartUpload,
    })),
    __mocks: {
      dynamo: {
        get,
        getPromise,
        deleteFn,
        deletePromise,
      },
      s3: {
        abortMultipartUpload,
        abortMultipartUploadPromise,
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
      deleteFn: jest.Mock;
      deletePromise: jest.Mock;
    };
    s3: {
      abortMultipartUpload: jest.Mock;
      abortMultipartUploadPromise: jest.Mock;
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
} satisfies Omit<AbortAssetUploadChainedRequestInput, 'input'>;

const buildRequest = () => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId: '1234567890',
      uploadSessionId: 'session-123',
    },
    body: {} as never,
  },
});

describe('AbortAssetUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        UploadSessionId: 'session-123',
        ExperienceId: '1234567890',
        CognitoUserId: 'cognito-user-123',
        Strategy: 'multipart-put',
        MultipartUploadId: 'upload-id-123',
        ObjectKey: '1234567890/asset-id/banner.gif',
      },
    });
    dynamoMocks.deletePromise.mockResolvedValue({});
    s3Mocks.abortMultipartUploadPromise.mockResolvedValue({});
  });

  it('aborts multipart upload and removes the upload session', async () => {
    const response = await abortAssetUpload(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Upload session aborted.',
    });
    expect(s3Mocks.abortMultipartUpload).toHaveBeenCalledWith({
      Bucket: 'asset-bucket',
      Key: '1234567890/asset-id/banner.gif',
      UploadId: 'upload-id-123',
    });
    expect(dynamoMocks.deleteFn).toHaveBeenCalledWith({
      TableName: 'AssetUploads',
      Key: {
        UploadSessionId: 'session-123',
      },
    });
  });

  it('returns success when session already does not exist', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: undefined,
    });

    const response = await abortAssetUpload(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Upload session already cleared.',
    });
    expect(s3Mocks.abortMultipartUpload).not.toHaveBeenCalled();
    expect(dynamoMocks.deleteFn).not.toHaveBeenCalled();
  });
});
