process.env.TASK_INSTANCE_TABLE_NAME = 'TaskInstances';
process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';
process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'secretArn';
process.env.EXPERIENCES_TABLE_NAME = 'Experiences';

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
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get: dynamoGetMock,
      })),
    },
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
  getAddOnContextMock.mockResolvedValue({
    data: {
      teacherContext: null,
      studentContext: null,
    },
  });
  dynamoGetMock.mockImplementation((params: { TableName: string }) => {
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
          Milestones: [
            {
              id: 'tour-the-rotunda',
              name: 'Tour the Rotunda',
              percentageContribution: 50,
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
          RobloxGameId: '1213026131',
        },
      },
    };

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
        milestones: [
          {
            id: 'tour-the-rotunda',
            name: 'Tour the Rotunda',
            percentageContribution: 50,
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
});
