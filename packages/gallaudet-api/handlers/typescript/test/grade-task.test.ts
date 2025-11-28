process.env.USERS_TABLE_NAME = 'Users';
process.env.TASK_INSTANCE_TABLE_NAME = 'TaskInstances';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';
process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'secretArn';

import {
  GradeTaskChainedRequestInput,
  NotAuthorizedErrorResponseContent,
  BadRequestErrorResponseContent,
  InternalFailureErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { GaxiosError } from 'gaxios';
import { gradeTask } from '../src/grade-task';
import { getGoogleOAuthClient } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => {
  const actual = jest.requireActual('../src/utils/auth-utils');
  return {
    ...actual,
    getGoogleOAuthClient: jest.fn(),
  };
});

jest.mock('aws-sdk', () => {
  const query = jest.fn();
  const get = jest.fn();
  const update = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query,
        get,
        update,
      })),
    },
    __mocks: {
      dynamo: {
        query,
        get,
        update,
      },
    },
  };
});

jest.mock('@googleapis/classroom', () => {
  const getAddOnContextMock = jest.fn();
  const studentSubmissionsListMock = jest.fn();
  const patchSubmissionMock = jest.fn();
  return {
    classroom: jest.fn(() => ({
      courses: {
        courseWork: {
          getAddOnContext: getAddOnContextMock,
          studentSubmissions: {
            list: studentSubmissionsListMock,
          },
          addOnAttachments: {
            studentSubmissions: {
              patch: patchSubmissionMock,
            },
          },
        },
      },
    })),
    __mocks: {
      getAddOnContextMock,
      studentSubmissionsListMock,
      patchSubmissionMock,
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: {
      query: jest.Mock;
      get: jest.Mock;
      update: jest.Mock;
    };
  };
};

const {
  __mocks: { getAddOnContextMock, studentSubmissionsListMock, patchSubmissionMock },
} = jest.requireMock('@googleapis/classroom') as {
  __mocks: {
    getAddOnContextMock: jest.Mock;
    studentSubmissionsListMock: jest.Mock;
    patchSubmissionMock: jest.Mock;
  };
};

const mockedGetGoogleOAuthClient = getGoogleOAuthClient as jest.Mock;

const baseRequestArgs = {
  chain: undefined as never,
  event: {
    requestContext: {
      identity: {
        apiKeyId: 'partner-123',
      },
    },
  } as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
} satisfies Omit<GradeTaskChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  dynamoMocks.query.mockReset();
  dynamoMocks.get.mockReset();
  dynamoMocks.update.mockReset();
  getAddOnContextMock.mockReset();
  studentSubmissionsListMock.mockReset();
  patchSubmissionMock.mockReset();
  mockedGetGoogleOAuthClient.mockReset();
  getAddOnContextMock.mockResolvedValue({
    data: {
      studentContext: {
        submissionId: '1234567890',
      },
    },
  });
});

const buildRequestArgs = (
  overrides: Partial<Omit<GradeTaskChainedRequestInput, 'input'>> = {},
) =>
  ({
    ...baseRequestArgs,
    ...overrides,
  }) as Omit<GradeTaskChainedRequestInput, 'input'>;

describe('gradeTask handler', () => {
  it('returns 403 when API key is missing', async () => {
    const response = await gradeTask({
      ...buildRequestArgs({
        event: {
          requestContext: {
            identity: {},
          },
        } as any,
      }),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 75,
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Valid API key required');
    expect(dynamoMocks.query).not.toHaveBeenCalled();
  });

  it('returns 400 when percentage is invalid', async () => {
    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 123,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(
      (response.body as BadRequestErrorResponseContent).message,
    ).toEqual('percentage must be between 0 and 100');
  });

  it('returns 400 when player mapping is missing', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [],
      }),
    });

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 80,
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(
      (response.body as BadRequestErrorResponseContent).message,
    ).toEqual('Player is not linked to a Google account');
    expect(dynamoMocks.get).not.toHaveBeenCalled();
  });

  it('returns 403 when partner does not own the task', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_112233',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-other',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 90,
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Partner not authorized to grade this task');
    expect(mockedGetGoogleOAuthClient).not.toHaveBeenCalled();
  });

  it('returns 403 when Classroom API denies student submission listing', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_112233',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-123',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });
    dynamoMocks.update.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
    dynamoMocks.update.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    const gaxiosError = new GaxiosError(
      'Forbidden',
      {
        url: 'https://classroom.googleapis.com',
        headers: {},
      } as any,
      {
        data: {
          error: {
            status: 'PERMISSION_DENIED',
          },
        },
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config: {},
        request: {},
      } as any,
    );

    studentSubmissionsListMock.mockRejectedValue(gaxiosError);

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 92,
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Student authorization missing required Classroom scopes');
    expect(
      (response.body as NotAuthorizedErrorResponseContent & { details?: string }).details,
    ).toContain('re-link');
  });

  it('returns 403 when student OAuth tokens are missing', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_112233',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-123',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });

    const missingTokensError = new Error('not found');
    missingTokensError.name = 'OAuthTokensForUserNotFoundError';
    mockedGetGoogleOAuthClient.mockRejectedValue(missingTokensError);

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 88,
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Player Google account not linked');
    expect(studentSubmissionsListMock).not.toHaveBeenCalled();
    expect(patchSubmissionMock).not.toHaveBeenCalled();
  });

  it('returns 500 when add-on submission id is missing', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_112233',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-123',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });

    getAddOnContextMock.mockResolvedValue({ data: {} });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    studentSubmissionsListMock.mockResolvedValue({
      data: {
        studentSubmissions: [
          {
            id: 'submission-1',
            userId: '112233',
          },
        ],
      },
    });

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 60,
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual('Failed to resolve add-on submission identifier');
    expect(patchSubmissionMock).not.toHaveBeenCalled();
  });

  it('returns 500 when add-on submission id is not numeric', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_112233',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-123',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });

    getAddOnContextMock.mockResolvedValue({
      data: {
        studentContext: {
          submissionId: 'Cg4IlOLtqcwXEIHw48vWFw',
        },
      },
    });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    studentSubmissionsListMock.mockResolvedValue({
      data: {
        studentSubmissions: [
          {
            id: 'submission-1',
            userId: '112233',
          },
        ],
      },
    });

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 60,
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual('Invalid add-on submission identifier returned by Classroom');
    expect(patchSubmissionMock).not.toHaveBeenCalled();
  });

  it('grades the task successfully', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_112852293390088774335',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-123',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });
    dynamoMocks.update.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    const studentClient = { setCredentials: jest.fn() };
    const teacherClient = { setCredentials: jest.fn() };
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    studentSubmissionsListMock.mockResolvedValue({
      data: {
        studentSubmissions: [
          {
            id: 'submission-1',
            userId: '112852293390088774335',
          },
        ],
      },
    });

    patchSubmissionMock.mockResolvedValue({});

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 85,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Task graded successfully',
    });

    expect(dynamoMocks.update).toHaveBeenCalledWith({
      TableName: 'TaskInstances',
      Key: {
        InstanceId: 'task-1',
      },
      UpdateExpression: 'SET #grades = :grades, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#grades': 'Grades',
        '#updatedAt': 'UpdatedAt',
      },
      ExpressionAttributeValues: {
        ':grades': {
          'cognito-student-1': 85,
        },
        ':updatedAt': expect.any(String),
      },
      ReturnValues: 'NONE',
    });
    expect(baseRequestArgs.interceptorContext.logger.error).not.toHaveBeenCalled();

    expect(studentSubmissionsListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course-1',
        courseWorkId: 'coursework-1',
        userId: 'me',
      }),
    );

    expect(patchSubmissionMock).toHaveBeenCalledWith({
      courseId: 'course-1',
      itemId: 'coursework-1',
      attachmentId: 'attachment-1',
      submissionId: '1234567890',
      updateMask: 'pointsEarned',
      requestBody: { pointsEarned: 85 },
    });
  });

  it('returns 500 when Classroom patch fails', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-student-1',
            Username: 'Google_198765',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: {
          InstanceId: 'task-1',
          PartnerId: 'partner-123',
          CourseId: 'course-1',
          ItemId: 'coursework-1',
          AttachmentId: 'attachment-1',
          CreatedBy: 'teacher-1',
        },
      }),
    });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    studentSubmissionsListMock.mockResolvedValue({
      data: {
        studentSubmissions: [
          {
            id: 'submission-99',
            userId: '198765',
          },
        ],
      },
    });

    const gaxiosError = new GaxiosError(
      'Bad Request',
      {
        url: 'https://classroom.googleapis.com',
        headers: {},
      } as any,
      {
        data: {},
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
        request: {},
      } as any,
    );
    patchSubmissionMock.mockRejectedValue(gaxiosError);

    const response = await gradeTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
        },
        body: {
          percentage: 70,
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual('Failed to grade task');
    expect(
      (response.body as InternalFailureErrorResponseContent & { details?: string }).details,
    ).toEqual('Bad Request');
  });
});
