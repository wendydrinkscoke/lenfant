process.env.ASSETS_BUCKET_NAME = 'asset-bucket';
process.env.ASSET_UPLOADS_TABLE_NAME = 'AssetUploads';
process.env.ASSETS_TABLE_NAME = 'Assets';
process.env.PROJECTS_TABLE_NAME = 'Projects';
process.env.ASSET_UPLOAD_URL_TTL_SECONDS = '900';
process.env.ASSET_MULTIPART_THRESHOLD_BYTES = '10000000';
process.env.ASSET_MULTIPART_PART_SIZE_BYTES = '8000000';

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
      experienceId: overrides?.experienceId ?? '1234567890',
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
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
      },
    });
    dynamoMocks.putPromise.mockResolvedValue({});
    s3Mocks.getSignedUrlPromise.mockResolvedValue('https://signed.example/upload');
    s3Mocks.createMultipartUploadPromise.mockResolvedValue({
      UploadId: 'upload-id-123',
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
      uploadUrl: 'https://signed.example/upload',
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
  });

  it('starts a multipart upload for large files', async () => {
    const response = await startAssetUpload(
      buildRequest({
        fileName: 'huge.gif',
        contentLengthBytes: 25_000_000,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      assetId: expect.any(String),
      uploadSessionId: expect.any(String),
      strategy: 'multipart-put',
      expiresAt: expect.any(Number),
      uploadUrl: undefined,
      multipartPartSizeBytes: 8000000,
      multipartPartCount: 4,
    });
    expect(s3Mocks.createMultipartUpload).toHaveBeenCalledWith({
      Bucket: 'asset-bucket',
      Key: expect.any(String),
      ContentType: 'image/gif',
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
