process.env.TASK_INSTANCE_TABLE_NAME = 'TaskInstances';
process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';
process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'secretArn';
process.env.EXPERIENCES_TABLE_NAME = 'Experiences';
process.env.ASSETS_TABLE_NAME = 'Assets';
process.env.ASSETS_BUCKET_NAME = 'AssetsBucket';

import {
  GetTaskChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import { getTask } from '../src/get-task';
import { getCognitoUserIdFromEvent, getGoogleOAuthClient } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
  getGoogleOAuthClient: jest.fn(),
}));

const getAddOnContextMock = jest.fn();
var dynamoGetMock: jest.Mock;
var s3GetSignedUrlPromiseMock: jest.Mock;

jest.mock('@googleapis/classroom', () => ({
  classroom: jest.fn(() => ({
    courses: {
      courseWork: {
        getAddOnContext: getAddOnContextMock,
      },
    },
  })),
}));

jest.mock('aws-sdk', () => {
  dynamoGetMock = jest.fn();
  s3GetSignedUrlPromiseMock = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get: dynamoGetMock,
      })),
    },
    S3: jest.fn(() => ({
      getSignedUrlPromise: s3GetSignedUrlPromiseMock,
    })),
  };
});

const baseArgs = {
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
} satisfies Omit<GetTaskChainedRequestInput, 'input'>;
const COGNITO_USER_ID = '3448c4d8-70e1-703a-6450-fbf81e4d71b4';
const TASK_ID = '35188e83-4c18-4138-9352-0c878422cc30';
const COURSE_ID = '810781632040';
const COURSE_WORK_ID = '850355934227';
const ATTACHMENT_ID = '850355867990';
const SUBMISSION_ID = '810762858772';
const EXPERIENCE_ID = '9228429469';
const ENTRY_ID = 'get-100-points';
const EXPERIENCE_NAME = 'Run The World! - Learn Country Names';
const TASK_ASSET_ID = '3a3573f1-1312-4f1f-9bed-9973b159dbcd';
const TASK_ASSET_FILENAME = 'paintball.gif';
const TASK_ASSET_OBJECT_KEY =
  `${COGNITO_USER_ID}/${EXPERIENCE_ID}/${TASK_ASSET_ID}/${TASK_ASSET_FILENAME}`;
const TASK_ASSET_URL =
  `https://assets-bucket.s3.amazonaws.com/${TASK_ASSET_OBJECT_KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TEST%2F20260308%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260308T101435Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=11aa22bb33cc44dd`;

beforeEach(() => {
  jest.clearAllMocks();
  (getCognitoUserIdFromEvent as jest.Mock).mockReturnValue(COGNITO_USER_ID);
  (getGoogleOAuthClient as jest.Mock).mockResolvedValue({});
  getAddOnContextMock.mockReset();
  dynamoGetMock.mockReset();
  s3GetSignedUrlPromiseMock.mockReset();
  s3GetSignedUrlPromiseMock.mockImplementation(
    async (_operation: string, params: { Key: string }) => {
      if (params.Key.endsWith('/paintball.gif')) {
        return TASK_ASSET_URL;
      }
      return 'https://assets-bucket.s3.amazonaws.com/generic.png?X-Amz-Algorithm=AWS4-HMAC-SHA256';
    },
  );
  getAddOnContextMock.mockResolvedValue({
    data: {
      teacherContext: null,
      studentContext: null,
    },
  });
  dynamoGetMock.mockImplementation((params: { TableName: string; Key?: Record<string, string> }) => {
    const responseByTable: Record<string, unknown> = {
      TaskInstances: {
        Item: {
          InstanceId: TASK_ID,
          CourseId: COURSE_ID,
          ItemId: COURSE_WORK_ID,
          ExperienceId: EXPERIENCE_ID,
          EntryId: ENTRY_ID,
          CatalogEntryName: 'Get 100 Points',
          AttachmentId: ATTACHMENT_ID,
        },
      },
      TaskCatalog: {
        Item: {
          ExperienceId: EXPERIENCE_ID,
          EntryId: ENTRY_ID,
          Name: 'Get 100 Points',
          Subheading: 'Obtain at least 100 points in one session',
          Instructions: 'Get points by selecting the correct country as quickly as possible.',
          AssetIds: [
            TASK_ASSET_ID,
          ],
        },
      },
      Experiences: {
        Item: {
          ExperienceId: EXPERIENCE_ID,
          ExperienceName: EXPERIENCE_NAME,
          ExperienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
          RobloxGameId: '127120714583972',
          AssetIds: [
            '07e3087d-7130-4c66-bf25-95b38295f0a7',
          ],
        },
      },
    };

    if (params.TableName === 'Assets') {
      const assetId = params.Key?.AssetId;
      if (assetId === TASK_ASSET_ID) {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: assetId,
              ExperienceId: EXPERIENCE_ID,
              FileName: TASK_ASSET_FILENAME,
              ContentType: 'image/gif',
              ObjectKey: TASK_ASSET_OBJECT_KEY,
              Status: 'ready',
            },
          }),
        };
      }
      return {
        promise: jest.fn().mockResolvedValue({}),
      };
    }

    return {
      promise: jest.fn().mockResolvedValue(responseByTable[params.TableName] ?? {}),
    };
  });
});

describe('GetTask', () => {
  it('returns task content when the caller is a student', async () => {
    getAddOnContextMock.mockResolvedValueOnce({
      data: {
        teacherContext: null,
        studentContext: {
          submissionId: SUBMISSION_ID,
        },
      },
    });
    const response = await getTask({
      ...baseArgs,
      input: {
        requestParameters: {
          taskId: TASK_ID,
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      task: {
        title: 'Get 100 Points',
        subheading: 'Obtain at least 100 points in one session',
        instructions: 'Get points by selecting the correct country as quickly as possible.',
        experienceName: EXPERIENCE_NAME,
        robloxGameId: '127120714583972',
        assetIds: [
          TASK_ASSET_ID,
        ],
        assets: [
          {
            assetId: TASK_ASSET_ID,
            fileName: TASK_ASSET_FILENAME,
            contentType: 'image/gif',
            url: TASK_ASSET_URL,
          },
        ],
        experienceAssetIds: [
          '07e3087d-7130-4c66-bf25-95b38295f0a7',
        ],
      },
    });
    expect(getAddOnContextMock).toHaveBeenCalledWith({
      courseId: COURSE_ID,
      itemId: COURSE_WORK_ID,
      attachmentId: ATTACHMENT_ID,
    });
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: TASK_ASSET_OBJECT_KEY,
      Expires: 900,
    });
  });

  it('returns 500 when Google cannot determine the viewer context', async () => {
    getAddOnContextMock.mockResolvedValueOnce({
      data: {
        teacherContext: null,
        studentContext: null,
      },
    });

    const response = await getTask({
      ...baseArgs,
      input: {
        requestParameters: {
          taskId: TASK_ID,
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: 'Unable to determine Google Classroom context for task',
    });
    expect(getAddOnContextMock).toHaveBeenCalledWith({
      courseId: COURSE_ID,
      itemId: COURSE_WORK_ID,
      attachmentId: ATTACHMENT_ID,
    });
  });

  it('returns 500 when getAddOnContext fails', async () => {
    getAddOnContextMock.mockRejectedValueOnce(new Error('boom'));

    const response = await getTask({
      ...baseArgs,
      input: {
        requestParameters: {
          taskId: TASK_ID,
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: 'Failed to verify Google Classroom context',
    });
    expect(getAddOnContextMock).toHaveBeenCalledWith({
      courseId: COURSE_ID,
      itemId: COURSE_WORK_ID,
      attachmentId: ATTACHMENT_ID,
    });
  });

  it('returns 500 when the experience metadata is missing', async () => {
    getAddOnContextMock.mockResolvedValueOnce({
      data: {
        teacherContext: {
          userId: '112852293390088774335',
        },
        studentContext: null,
      },
    });

    const originalGetImplementation = dynamoGetMock.getMockImplementation();
    dynamoGetMock.mockImplementation((params: { TableName: string; Key?: Record<string, string> }) => {
      if (params.TableName === 'Experiences') {
        return {
          promise: jest.fn().mockResolvedValue({}),
        };
      }

      if (originalGetImplementation) {
        return originalGetImplementation(params);
      }

      return {
        promise: jest.fn().mockResolvedValue({}),
      };
    });

    const response = await getTask({
      ...baseArgs,
      input: {
        requestParameters: {
          taskId: TASK_ID,
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: 'Failed to load task content',
    });
  });
});
