process.env.ASSETS_BUCKET_NAME = 'asset-bucket';
process.env.ASSET_UPLOADS_TABLE_NAME = 'AssetUploads';
process.env.ASSETS_TABLE_NAME = 'Assets';
process.env.PROJECTS_TABLE_NAME = 'Projects';
process.env.ASSET_UPLOAD_URL_TTL_SECONDS = '900';
process.env.ASSET_MULTIPART_THRESHOLD_BYTES = '10000000';
process.env.ASSET_MULTIPART_PART_SIZE_BYTES = '8388608';

import {
  StartAssetUploadChainedRequestInput,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { startAssetUpload } from '../src/start-asset-upload';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const getPromise = jest.fn();
  const putPromise = jest.fn();
  const get = jest.fn(() => ({ promise: getPromise }));
  const put = jest.fn(() => ({ promise: putPromise }));

  const getSignedUrlPromise = jest.fn();
  const createMultipartUploadPromise = jest.fn();
  const createMultipartUpload = jest.fn(() => ({ promise: createMultipartUploadPromise }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get,
        put,
      })),
    },
    S3: jest.fn(() => ({
      getSignedUrlPromise,
      createMultipartUpload,
    })),
    __mocks: {
      dynamo: {
        get,
        getPromise,
        put,
        putPromise,
      },
      s3: {
        getSignedUrlPromise,
        createMultipartUpload,
        createMultipartUploadPromise,
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
    };
    s3: {
      getSignedUrlPromise: jest.Mock;
      createMultipartUpload: jest.Mock;
      createMultipartUploadPromise: jest.Mock;
    };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;

const COGNITO_USER_ID = '3448c4d8-70e1-703a-6450-fbf81e4d71b4';
const EXPERIENCE_ID = '9228429469';
const MULTIPART_UPLOAD_ID = 'zHA4WIi4vnWEPM8UOh2q6sgVtjxYucWoLFrvaQ9LesXrhUaZ9MrHprzr3FBTRr5nf6Yt3xJ3JT45dsTgj5N1LoBX_u251Rh0IRZbXWJwHlhfdmetmt90HqF.Itz6Bi8lnwMFOE5qTGwizPr60AFTcOUSqATaHyGppsqAmWqtqaBzpy49oIYibLycI4XV4hu8oSEJsIK3lRMUxJ5jPxbqyg--';
const SINGLE_PART_UPLOAD_URL = 'https://asset-bucket.s3.amazonaws.com/3448c4d8-70e1-703a-6450-fbf81e4d71b4/9228429469/1919b0d6-be31-4f6f-8afe-1d97f8c3f60a/banner.gif?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TEST%2F20260308%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260308T101435Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=abcdef0123456789';

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
} satisfies Omit<StartAssetUploadChainedRequestInput, 'input'>;

const buildRequest = (overrides?: {
  experienceId?: string;
  fileName?: string;
  contentType?: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  contentLengthBytes?: number;
}) => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId: overrides?.experienceId ?? EXPERIENCE_ID,
    },
    body: {
      fileName: overrides?.fileName ?? 'banner.gif',
      contentType: overrides?.contentType ?? 'image/gif',
      contentLengthBytes: overrides?.contentLengthBytes ?? 2_048_000,
    },
  },
});

describe('StartAssetUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue(COGNITO_USER_ID);
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        CognitoUserId: COGNITO_USER_ID,
        ExperienceId: EXPERIENCE_ID,
      },
    });
    dynamoMocks.putPromise.mockResolvedValue({});
    s3Mocks.getSignedUrlPromise.mockResolvedValue(SINGLE_PART_UPLOAD_URL);
    s3Mocks.createMultipartUploadPromise.mockResolvedValue({
      UploadId: MULTIPART_UPLOAD_ID,
    });
  });

  it('starts a single-part upload for small files', async () => {
    const response = await startAssetUpload(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      assetId: expect.any(String),
      uploadSessionId: expect.any(String),
      strategy: 'single-part-put',
      expiresAt: expect.any(Number),
      uploadUrl: SINGLE_PART_UPLOAD_URL,
      multipartPartSizeBytes: undefined,
      multipartPartCount: undefined,
    });
    expect(s3Mocks.getSignedUrlPromise).toHaveBeenCalledWith('putObject', {
      Bucket: 'asset-bucket',
      Key: expect.any(String),
      ContentType: 'image/gif',
      Expires: 900,
    });
    expect(s3Mocks.createMultipartUpload).not.toHaveBeenCalled();
    expect(dynamoMocks.put).toHaveBeenCalledTimes(2);
    expect(dynamoMocks.put).toHaveBeenNthCalledWith(2, {
      TableName: 'AssetUploads',
      Item: expect.objectContaining({
        UploadSessionId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        AssetId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        CognitoUserId: COGNITO_USER_ID,
        ContentType: 'image/gif',
        CreatedAt: expect.any(Number),
        ExperienceId: EXPERIENCE_ID,
        ExpiresAt: expect.any(Number),
        FileName: 'banner.gif',
        MultipartPartCount: undefined,
        MultipartPartSizeBytes: undefined,
        MultipartUploadId: undefined,
        ObjectKey: expect.stringMatching(
          /^3448c4d8-70e1-703a-6450-fbf81e4d71b4\/9228429469\/[0-9a-f-]{36}\/banner\.gif$/,
        ),
        SizeBytes: 2_048_000,
        Strategy: 'single-part-put',
        UpdatedAt: expect.any(Number),
      }),
    });
  });

  it('starts a multipart upload for large files', async () => {
    const response = await startAssetUpload(
      buildRequest({
        fileName: 'big-image.png',
        contentType: 'image/png',
        contentLengthBytes: 16_927_656,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      assetId: expect.any(String),
      uploadSessionId: expect.any(String),
      strategy: 'multipart-put',
      expiresAt: expect.any(Number),
      uploadUrl: undefined,
      multipartPartSizeBytes: 8_388_608,
      multipartPartCount: 3,
    });
    expect(s3Mocks.createMultipartUpload).toHaveBeenCalledWith({
      Bucket: 'asset-bucket',
      Key: expect.any(String),
      ContentType: 'image/png',
    });
    expect(dynamoMocks.put).toHaveBeenNthCalledWith(2, {
      TableName: 'AssetUploads',
      Item: expect.objectContaining({
        UploadSessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        AssetId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        CognitoUserId: COGNITO_USER_ID,
        ContentType: 'image/png',
        CreatedAt: expect.any(Number),
        ExperienceId: EXPERIENCE_ID,
        ExpiresAt: expect.any(Number),
        FileName: 'big-image.png',
        MultipartPartCount: 3,
        MultipartPartSizeBytes: 8_388_608,
        MultipartUploadId: MULTIPART_UPLOAD_ID,
        ObjectKey: expect.stringMatching(
          /^3448c4d8-70e1-703a-6450-fbf81e4d71b4\/9228429469\/[0-9a-f-]{36}\/big-image\.png$/,
        ),
        SizeBytes: 16_927_656,
        Strategy: 'multipart-put',
        UpdatedAt: expect.any(Number),
      }),
    });
  });

  it('returns not authorized when no authenticated user is present', async () => {
    mockedGetCognitoUserIdFromEvent.mockImplementation(() => {
      throw new Error('Cognito User ID not parseable from event.');
    });

    const response = await startAssetUpload(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Authentication required',
    );
  });
});
