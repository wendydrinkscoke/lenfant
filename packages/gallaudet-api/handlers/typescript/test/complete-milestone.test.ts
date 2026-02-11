process.env.USERS_TABLE_NAME = 'Users';
process.env.TASK_INSTANCE_TABLE_NAME = 'TaskInstances';
process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';
process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'secretArn';

import {
  CompleteMilestoneChainedRequestInput,
  BadRequestErrorResponseContent,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { GaxiosError } from 'gaxios';
import { completeMilestone } from '../src/complete-milestone';
import { getGoogleOAuthClient, getPartnerIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => {
  const actual = jest.requireActual('../src/utils/auth-utils');
  return {
    ...actual,
    getGoogleOAuthClient: jest.fn(),
    getPartnerIdFromEvent: jest.fn(),
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
} satisfies Omit<CompleteMilestoneChainedRequestInput, 'input'>;

const buildRequestArgs = () => ({
  ...baseRequestArgs,
});

describe('CompleteMilestone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetGoogleOAuthClient.mockReset();
    (getPartnerIdFromEvent as jest.Mock).mockReset();
    (getPartnerIdFromEvent as jest.Mock).mockResolvedValue('partner-123');
    dynamoMocks.query.mockReset();
    dynamoMocks.get.mockReset();
    dynamoMocks.update.mockReset();
    getAddOnContextMock.mockReset();
    studentSubmissionsListMock.mockReset();
    patchSubmissionMock.mockReset();

    dynamoMocks.update.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    getAddOnContextMock.mockResolvedValue({
      data: {
        studentContext: {
          submissionId: '1234567890',
        },
      },
    });

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
  });

  it('records milestone completion and updates Classroom grade', async () => {
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

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: 'task-1',
            PartnerId: 'partner-123',
            CourseId: 'course-1',
            ItemId: 'coursework-1',
            AttachmentId: 'attachment-1',
            CreatedBy: 'teacher-1',
            EntryId: 'tour-whitehouse',
            MilestoneCompletions: {},
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            PartnerId: 'partner-123',
            EntryId: 'tour-whitehouse',
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 40,
              },
              {
                id: 'visit-situation-room',
                name: 'Visit the Situation Room',
                percentageContribution: 60,
              },
            ],
          },
        }),
      });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    const response = await completeMilestone({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
          milestoneId: 'visit-oval-office',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      updatedCumulativePercentage: 40,
      nextMilestoneId: 'visit-situation-room',
      nextMilestoneName: 'Visit the Situation Room',
      nextMilestonePercentageContribution: 60,
    });

    expect(dynamoMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'TaskInstances',
        Key: { InstanceId: 'task-1' },
        ExpressionAttributeValues: expect.objectContaining({
          ':milestoneCompletions': {
            'cognito-student-1': ['visit-oval-office'],
          },
        }),
      }),
    );

    expect(patchSubmissionMock).toHaveBeenCalledWith({
      courseId: 'course-1',
      itemId: 'coursework-1',
      attachmentId: 'attachment-1',
      submissionId: '1234567890',
      updateMask: 'pointsEarned',
      requestBody: { pointsEarned: 40 },
    });
  });

  it('is idempotent when milestone already completed', async () => {
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

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: 'task-1',
            PartnerId: 'partner-123',
            CourseId: 'course-1',
            ItemId: 'coursework-1',
            AttachmentId: 'attachment-1',
            CreatedBy: 'teacher-1',
            EntryId: 'tour-whitehouse',
            MilestoneCompletions: {
              'cognito-student-1': ['visit-oval-office'],
            },
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            PartnerId: 'partner-123',
            EntryId: 'tour-whitehouse',
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 40,
              },
            ],
          },
        }),
      });

    dynamoMocks.update.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    const response = await completeMilestone({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
          milestoneId: 'visit-oval-office',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      updatedCumulativePercentage: 40,
    });

    expect(dynamoMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':milestoneCompletions': {
            'cognito-student-1': ['visit-oval-office'],
          },
        }),
      }),
    );
  });

  it('returns 400 when milestone is not defined on the task', async () => {
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

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: 'task-1',
            PartnerId: 'partner-123',
            CourseId: 'course-1',
            ItemId: 'coursework-1',
            AttachmentId: 'attachment-1',
            CreatedBy: 'teacher-1',
            EntryId: 'tour-whitehouse',
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            PartnerId: 'partner-123',
            EntryId: 'tour-whitehouse',
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 40,
              },
            ],
          },
        }),
      });

    dynamoMocks.update.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    const studentClient = {};
    const teacherClient = {};
    mockedGetGoogleOAuthClient
      .mockResolvedValueOnce(studentClient)
      .mockResolvedValueOnce(teacherClient);

    const response = await completeMilestone({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
          milestoneId: 'unknown-milestone',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'Milestone not defined for task',
    );
  });

  it('returns 500 when Classroom patch fails', async () => {
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

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: 'task-1',
            PartnerId: 'partner-123',
            CourseId: 'course-1',
            ItemId: 'coursework-1',
            AttachmentId: 'attachment-1',
            CreatedBy: 'teacher-1',
            EntryId: 'tour-whitehouse',
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            PartnerId: 'partner-123',
            EntryId: 'tour-whitehouse',
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 40,
              },
            ],
          },
        }),
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

    const response = await completeMilestone({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
          milestoneId: 'visit-oval-office',
        },
        body: undefined as never,
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

  it('returns 400 when player mapping is missing', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] }),
    });

    const response = await completeMilestone({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
          milestoneId: 'visit-oval-office',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual(
      'Player is not linked to a Google account',
    );
  });

  it('returns 403 when student OAuth tokens are missing', async () => {
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

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: 'task-1',
            PartnerId: 'partner-123',
            CourseId: 'course-1',
            ItemId: 'coursework-1',
            AttachmentId: 'attachment-1',
            CreatedBy: 'teacher-1',
            EntryId: 'tour-whitehouse',
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            PartnerId: 'partner-123',
            EntryId: 'tour-whitehouse',
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageAwarded: 40,
              },
            ],
          },
        }),
      });

    mockedGetGoogleOAuthClient.mockImplementation(() => {
      const error = new Error('not found');
      (error as Error).name = 'OAuthTokensForUserNotFoundError';
      return Promise.reject(error);
    });

    const response = await completeMilestone({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: 'roblox-1',
          taskId: 'task-1',
          milestoneId: 'visit-oval-office',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Player Google account not linked',
    );
  });
});
