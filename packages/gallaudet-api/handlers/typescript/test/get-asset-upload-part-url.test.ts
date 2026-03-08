process.env.ASSETS_BUCKET_NAME = 'asset-bucket';
process.env.ASSET_UPLOADS_TABLE_NAME = 'AssetUploads';
process.env.ASSET_UPLOAD_URL_TTL_SECONDS = '900';

import {
  GetAssetUploadPartUrlChainedRequestInput,
  BadRequestErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getAssetUploadPartUrl } from '../src/get-asset-upload-part-url';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const getPromise = jest.fn();
  const get = jest.fn(() => ({ promise: getPromise }));
  const getSignedUrlPromise = jest.fn();

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get,
      })),
    },
    S3: jest.fn(() => ({
      getSignedUrlPromise,
    })),
    __mocks: {
      dynamo: {
        get,
        getPromise,
      },
      s3: {
        getSignedUrlPromise,
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
    };
    s3: {
      getSignedUrlPromise: jest.Mock;
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
const MULTIPART_PART_UPLOAD_URL = `https://asset-bucket.s3.amazonaws.com/${OBJECT_KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TEST%2F20260308%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260308T101437Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=1234abcdef5678&partNumber=2&uploadId=${encodeURIComponent(MULTIPART_UPLOAD_ID)}`;

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
} satisfies Omit<GetAssetUploadPartUrlChainedRequestInput, 'input'>;

const buildRequest = (overrides?: {
  partNumber?: number;
  uploadSessionId?: string;
  experienceId?: string;
}) => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId: overrides?.experienceId ?? EXPERIENCE_ID,
      uploadSessionId: overrides?.uploadSessionId ?? UPLOAD_SESSION_ID,
      partNumber: overrides?.partNumber ?? 2,
    },
    body: {} as never,
  },
});

describe('GetAssetUploadPartUrl', () => {
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
        MultipartUploadId: MULTIPART_UPLOAD_ID,
        ObjectKey: OBJECT_KEY,
        SizeBytes: 16927656,
        Strategy: 'multipart-put',
        UpdatedAt: 1772964874,
      },
    });
    s3Mocks.getSignedUrlPromise.mockResolvedValue(MULTIPART_PART_UPLOAD_URL);
  });

  it('returns a signed upload URL for the requested part', async () => {
    const response = await getAssetUploadPartUrl(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      uploadUrl: MULTIPART_PART_UPLOAD_URL,
      expiresAt: expect.any(Number),
    });
    expect(s3Mocks.getSignedUrlPromise).toHaveBeenCalledWith('uploadPart', {
      Bucket: 'asset-bucket',
      Key: OBJECT_KEY,
      UploadId: MULTIPART_UPLOAD_ID,
      PartNumber: 2,
      Expires: 900,
    });
  });

  it('returns bad request when part number exceeds the planned part count', async () => {
    const response = await getAssetUploadPartUrl(
      buildRequest({
        partNumber: 9,
      }),
    );

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'partNumber exceeds multipart part count.',
    );
    expect(s3Mocks.getSignedUrlPromise).not.toHaveBeenCalled();
  });

  it('returns bad request when the upload session is not multipart', async () => {
    dynamoMocks.getPromise.mockResolvedValueOnce({
      Item: {
        UploadSessionId: UPLOAD_SESSION_ID,
        AssetId: ASSET_ID,
        CognitoUserId: COGNITO_USER_ID,
        ContentType: 'image/png',
        CreatedAt: 1772964874,
        ExperienceId: EXPERIENCE_ID,
        ExpiresAt: 1772965774,
        FileName: FILE_NAME,
        ObjectKey: OBJECT_KEY,
        SizeBytes: 16927656,
        Strategy: 'single-part-put',
        UpdatedAt: 1772964874,
      },
    });

    const response = await getAssetUploadPartUrl(buildRequest());

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'This upload session does not use multipart uploads.',
    );
  });
});
