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

const COGNITO_USER_ID = '3448c4d8-70e1-703a-6450-fbf81e4d71b4';
const EXPERIENCE_ID = '9228429469';
const UPLOAD_SESSION_ID = '212f4c37-89c9-4780-bf40-01aaa7be826b';
const ASSET_ID = '1919b0d6-be31-4f6f-8afe-1d97f8c3f60a';
const FILE_NAME = 'big-image.png';
const OBJECT_KEY = `${COGNITO_USER_ID}/${EXPERIENCE_ID}/${ASSET_ID}/${FILE_NAME}`;
const MULTIPART_UPLOAD_ID = 'zHA4WIi4vnWEPM8UOh2q6sgVtjxYucWoLFrvaQ9LesXrhUaZ9MrHprzr3FBTRr5nf6Yt3xJ3JT45dsTgj5N1LoBX_u251Rh0IRZbXWJwHlhfdmetmt90HqF.Itz6Bi8lnwMFOE5qTGwizPr60AFTcOUSqATaHyGppsqAmWqtqaBzpy49oIYibLycI4XV4hu8oSEJsIK3lRMUxJ5jPxbqyg--';

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
      experienceId: EXPERIENCE_ID,
      uploadSessionId: UPLOAD_SESSION_ID,
    },
    body: {} as never,
  },
});

describe('AbortAssetUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue(COGNITO_USER_ID);
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        UploadSessionId: UPLOAD_SESSION_ID,
        AssetId: ASSET_ID,
        CognitoUserId: COGNITO_USER_ID,
        ContentType: 'image/png',
        CreatedAt: 1772964874,
        ExperienceId: EXPERIENCE_ID,
        ExpiresAt: 1772965774,
        FileName: FILE_NAME,
        MultipartPartCount: 3,
        MultipartPartSizeBytes: 8388608,
        Strategy: 'multipart-put',
        MultipartUploadId: MULTIPART_UPLOAD_ID,
        ObjectKey: OBJECT_KEY,
        SizeBytes: 16927656,
        UpdatedAt: 1772964874,
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
      Key: OBJECT_KEY,
      UploadId: MULTIPART_UPLOAD_ID,
    });
    expect(dynamoMocks.deleteFn).toHaveBeenCalledWith({
      TableName: 'AssetUploads',
      Key: {
        UploadSessionId: UPLOAD_SESSION_ID,
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
