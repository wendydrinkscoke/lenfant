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

beforeEach(() => {
  jest.clearAllMocks();
  (getCognitoUserIdFromEvent as jest.Mock).mockReturnValue('user-123');
  (getGoogleOAuthClient as jest.Mock).mockResolvedValue({});
  getAddOnContextMock.mockReset();
  dynamoGetMock.mockReset();
  s3GetSignedUrlPromiseMock.mockReset();
  s3GetSignedUrlPromiseMock.mockImplementation(
    async (_operation: string, params: { Key: string }) => {
      if (params.Key.endsWith('/task-preview.gif')) {
        return 'https://assets-bucket.s3.amazonaws.com/presigned-task-asset';
      }
      if (params.Key.endsWith('/milestone-preview.png')) {
        return 'https://assets-bucket.s3.amazonaws.com/presigned-milestone-asset';
      }
      return 'https://assets-bucket.s3.amazonaws.com/presigned-generic-asset';
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
          InstanceId: 'task-123',
          CourseId: 'course-456',
          ItemId: 'courseWork-789',
          ExperienceId: 'studio-42',
          EntryId: 'demo-task',
          CatalogEntryName: 'Demo Task',
          AttachmentId: 'attach-111',
        },
      },
      TaskCatalog: {
        Item: {
          ExperienceId: 'studio-42',
          ExperienceName: 'Studio Forty Two',
          EntryId: 'demo-task',
          Name: 'Explore the Capitol',
          Subheading: 'Learn about the U.S. Capitol building',
          Instructions: 'Meet the guide and collect badges.',
          AssetIds: [
            '25242edd-4e8b-4b84-9588-3d472d927b9a',
          ],
          Milestones: [
            {
              id: 'tour-the-rotunda',
              name: 'Tour the Rotunda',
              percentageContribution: 50,
              assetIds: [
                'bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a',
              ],
            },
            {
              id: 'meet-your-guide',
              name: 'Meet your guide',
              percentageContribution: 50,
            },
          ],
        },
      },
      Experiences: {
        Item: {
          ExperienceId: 'studio-42',
          ExperienceName: 'Studio Forty Two',
          ExperienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
          RobloxGameId: '1213026131',
          AssetIds: [
            '07e3087d-7130-4c66-bf25-95b38295f0a7',
          ],
        },
      },
    };

    if (params.TableName === 'Assets') {
      const assetId = params.Key?.AssetId;
      if (assetId === '25242edd-4e8b-4b84-9588-3d472d927b9a') {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: assetId,
              ExperienceId: 'studio-42',
              FileName: 'task-preview.gif',
              ContentType: 'image/gif',
              ObjectKey: 'mock-cognito/studio-42/25242edd-4e8b-4b84-9588-3d472d927b9a/task-preview.gif',
              Status: 'ready',
            },
          }),
        };
      }
      if (assetId === 'bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a') {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: assetId,
              ExperienceId: 'studio-42',
              FileName: 'milestone-preview.png',
              ContentType: 'image/png',
              ObjectKey: 'mock-cognito/studio-42/bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a/milestone-preview.png',
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
  it('returns task content when the caller is a teacher', async () => {
    getAddOnContextMock.mockResolvedValueOnce({
      data: {
        teacherContext: {
          userId: 'teacher-321',
        },
        studentContext: null,
      },
    });
    const response = await getTask({
      ...baseArgs,
      input: {
        requestParameters: {
          taskId: 'task-123',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      task: {
        title: 'Explore the Capitol',
        subheading: 'Learn about the U.S. Capitol building',
        instructions: 'Meet the guide and collect badges.',
        experienceName: 'Studio Forty Two',
        robloxGameId: '1213026131',
        assetIds: [
          '25242edd-4e8b-4b84-9588-3d472d927b9a',
        ],
        assets: [
          {
            assetId: '25242edd-4e8b-4b84-9588-3d472d927b9a',
            fileName: 'task-preview.gif',
            contentType: 'image/gif',
            url: 'https://assets-bucket.s3.amazonaws.com/presigned-task-asset',
          },
          {
            assetId: 'bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a',
            fileName: 'milestone-preview.png',
            contentType: 'image/png',
            url: 'https://assets-bucket.s3.amazonaws.com/presigned-milestone-asset',
          },
        ],
        experienceAssetIds: [
          '07e3087d-7130-4c66-bf25-95b38295f0a7',
        ],
        milestones: [
          {
            id: 'tour-the-rotunda',
            name: 'Tour the Rotunda',
            percentageContribution: 50,
            assetIds: [
              'bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a',
            ],
          },
          {
            id: 'meet-your-guide',
            name: 'Meet your guide',
            percentageContribution: 50,
          },
        ],
      },
    });
    expect(getAddOnContextMock).toHaveBeenCalledWith({
      courseId: 'course-456',
      itemId: 'courseWork-789',
      attachmentId: 'attach-111',
    });
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: 'mock-cognito/studio-42/25242edd-4e8b-4b84-9588-3d472d927b9a/task-preview.gif',
      Expires: 900,
    });
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: 'mock-cognito/studio-42/bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a/milestone-preview.png',
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
          taskId: 'task-123',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: 'Unable to determine Google Classroom context for task',
    });
    expect(getAddOnContextMock).toHaveBeenCalledWith({
      courseId: 'course-456',
      itemId: 'courseWork-789',
      attachmentId: 'attach-111',
    });
  });

  it('returns 500 when getAddOnContext fails', async () => {
    getAddOnContextMock.mockRejectedValueOnce(new Error('boom'));

    const response = await getTask({
      ...baseArgs,
      input: {
        requestParameters: {
          taskId: 'task-123',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      message: 'Failed to verify Google Classroom context',
    });
    expect(getAddOnContextMock).toHaveBeenCalledWith({
      courseId: 'course-456',
      itemId: 'courseWork-789',
      attachmentId: 'attach-111',
    });
  });

  it('returns 500 when the experience metadata is missing', async () => {
    getAddOnContextMock.mockResolvedValueOnce({
      data: {
        teacherContext: {
          userId: 'teacher-321',
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
          taskId: 'task-123',
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
