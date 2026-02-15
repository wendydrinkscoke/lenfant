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
      experienceId: overrides?.experienceId ?? '1234567890',
      uploadSessionId: overrides?.uploadSessionId ?? 'session-123',
      partNumber: overrides?.partNumber ?? 2,
    },
    body: {} as never,
  },
});

describe('GetAssetUploadPartUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.getPromise.mockResolvedValue({
      Item: {
        UploadSessionId: 'session-123',
        ExperienceId: '1234567890',
        CognitoUserId: 'cognito-user-123',
        Strategy: 'multipart-put',
        ObjectKey: '1234567890/asset-id/banner.gif',
        MultipartUploadId: 'upload-id-123',
        MultipartPartCount: 5,
      },
    });
    s3Mocks.getSignedUrlPromise.mockResolvedValue('https://signed.example/part');
  });

  it('returns a signed upload URL for the requested part', async () => {
    const response = await getAssetUploadPartUrl(buildRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      uploadUrl: 'https://signed.example/part',
      expiresAt: expect.any(Number),
    });
    expect(s3Mocks.getSignedUrlPromise).toHaveBeenCalledWith('uploadPart', {
      Bucket: 'asset-bucket',
      Key: '1234567890/asset-id/banner.gif',
      UploadId: 'upload-id-123',
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
        UploadSessionId: 'session-123',
        ExperienceId: '1234567890',
        CognitoUserId: 'cognito-user-123',
        Strategy: 'single-part-put',
      },
    });

    const response = await getAssetUploadPartUrl(buildRequest());

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'This upload session does not use multipart uploads.',
    );
  });
});
