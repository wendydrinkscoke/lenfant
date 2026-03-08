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
} satisfies Omit<CompleteAssetUploadChainedRequestInput, 'input'>;

const buildSinglePartRequest = () => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId: EXPERIENCE_ID,
      uploadSessionId: UPLOAD_SESSION_ID,
    },
    body: {
      completion: {
        singlePart: {
          eTag: '"9a0364b9e99bb480dd25e1f0284c8555"',
        },
      },
    },
  },
});

describe('CompleteAssetUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue(COGNITO_USER_ID);
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        UploadSessionId: UPLOAD_SESSION_ID,
        AssetId: ASSET_ID,
        CognitoUserId: COGNITO_USER_ID,
        ExperienceId: EXPERIENCE_ID,
        FileName: FILE_NAME,
        ContentType: 'image/png',
        SizeBytes: 16927656,
        ObjectKey: OBJECT_KEY,
        Strategy: 'single-part-put',
        ExpiresAt: 1772965774,
        CreatedAt: 1772964874,
        UpdatedAt: 1772964874,
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
        assetId: ASSET_ID,
        experienceId: EXPERIENCE_ID,
        fileName: FILE_NAME,
        contentType: 'image/png',
        sizeBytes: 16927656,
        objectKey: OBJECT_KEY,
        status: 'ready',
        createdAt: 1772964874,
        updatedAt: expect.any(Number),
      },
    });
    expect(dynamoMocks.put).toHaveBeenCalled();
    expect(dynamoMocks.deleteFn).toHaveBeenCalledWith({
      TableName: 'AssetUploads',
      Key: {
        UploadSessionId: UPLOAD_SESSION_ID,
      },
    });
    expect(s3Mocks.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('completes a multipart upload when multipart completion details are provided', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        UploadSessionId: UPLOAD_SESSION_ID,
        AssetId: ASSET_ID,
        CognitoUserId: COGNITO_USER_ID,
        ExperienceId: EXPERIENCE_ID,
        FileName: FILE_NAME,
        ContentType: 'image/png',
        SizeBytes: 16927656,
        ObjectKey: OBJECT_KEY,
        Strategy: 'multipart-put',
        MultipartUploadId: MULTIPART_UPLOAD_ID,
        MultipartPartSizeBytes: 8388608,
        MultipartPartCount: 3,
        ExpiresAt: 1772965774,
        CreatedAt: 1772964874,
        UpdatedAt: 1772964874,
      },
    });

    const response = await completeAssetUpload({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: EXPERIENCE_ID,
          uploadSessionId: UPLOAD_SESSION_ID,
        },
        body: {
          completion: {
            multipart: {
              parts: [
                { partNumber: 2, eTag: '"6f5902ac237024bdd0c176cb93063dc4"' },
                { partNumber: 1, eTag: '"c4ca4238a0b923820dcc509a6f75849b"' },
              ],
            },
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(s3Mocks.completeMultipartUpload).toHaveBeenCalledWith({
      Bucket: 'asset-bucket',
      Key: OBJECT_KEY,
      UploadId: MULTIPART_UPLOAD_ID,
      MultipartUpload: {
        Parts: [
          { ETag: '"c4ca4238a0b923820dcc509a6f75849b"', PartNumber: 1 },
          { ETag: '"6f5902ac237024bdd0c176cb93063dc4"', PartNumber: 2 },
        ],
      },
    });
  });

  it('returns bad request when both singlePart and multipart payloads are provided', async () => {
    const response = await completeAssetUpload({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: EXPERIENCE_ID,
          uploadSessionId: UPLOAD_SESSION_ID,
        },
        body: {
          completion: {
            singlePart: { eTag: '"eccbc87e4b5ce2fe28308fd9f2a7baf3"' },
            multipart: { parts: [{ partNumber: 1, eTag: '"a87ff679a2f3e71d9181a67b7542122c"' }] },
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
