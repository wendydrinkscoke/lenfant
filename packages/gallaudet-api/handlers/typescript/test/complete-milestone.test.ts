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
import { getGoogleOAuthClient, getExperienceIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => {
  const actual = jest.requireActual('../src/utils/auth-utils');
  return {
    ...actual,
    getGoogleOAuthClient: jest.fn(),
    getExperienceIdFromEvent: jest.fn(),
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
        apiKeyId: 'f2ouqfm233',
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
    (getExperienceIdFromEvent as jest.Mock).mockReset();
    (getExperienceIdFromEvent as jest.Mock).mockResolvedValue('6m3q5dsoej');
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
          submissionId: '810762858772',
        },
      },
    });

    studentSubmissionsListMock.mockResolvedValue({
      data: {
        studentSubmissions: [
          {
            id: 'Cg4IlOLtqcwXEMOwm6PfFw',
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
            CognitoUserId: '14b8d408-c0a1-706f-f3f4-5d775f820f4c',
            Username: 'Google_112852293390088774335',
          },
        ],
      }),
    });

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
            ExperienceId: '6m3q5dsoej',
            CourseId: '810781632040',
            ItemId: '815849199683',
            AttachmentId: '815849744756',
            CreatedBy: 'f47874b8-e001-7099-7b8a-5d1792d6122b',
            EntryId: 'tour-the-whitehouse',
            MilestoneCompletions: {},
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: '6m3q5dsoej',
            EntryId: 'tour-the-whitehouse',
            Milestones: [
              {
                id: 'visit-the-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
              },
              {
                id: 'visit-the-situation-room',
                name: 'Visit the Situation Room',
                percentageContribution: 50,
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
          robloxUserId: '7954006733',
          taskId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
          milestoneId: 'visit-the-oval-office',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      updatedCumulativePercentage: 50,
      nextMilestoneId: 'visit-the-situation-room',
      nextMilestoneName: 'Visit the Situation Room',
      nextMilestonePercentageContribution: 50,
    });

    expect(dynamoMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'TaskInstances',
        Key: { InstanceId: '6461d2d2-6a96-490a-91f7-bbebb219f815' },
        ExpressionAttributeValues: expect.objectContaining({
          ':milestoneCompletions': {
            '14b8d408-c0a1-706f-f3f4-5d775f820f4c': ['visit-the-oval-office'],
          },
        }),
      }),
    );

    expect(patchSubmissionMock).toHaveBeenCalledWith({
      courseId: '810781632040',
      itemId: '815849199683',
      attachmentId: '815849744756',
      submissionId: '810762858772',
      updateMask: 'pointsEarned',
      requestBody: { pointsEarned: 50 },
    });
  });

  it('is idempotent when milestone already completed', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: '14b8d408-c0a1-706f-f3f4-5d775f820f4c',
            Username: 'Google_112852293390088774335',
          },
        ],
      }),
    });

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
            ExperienceId: '6m3q5dsoej',
            CourseId: '810781632040',
            ItemId: '815849199683',
            AttachmentId: '815849744756',
            CreatedBy: 'f47874b8-e001-7099-7b8a-5d1792d6122b',
            EntryId: 'tour-the-whitehouse',
            MilestoneCompletions: {
              '14b8d408-c0a1-706f-f3f4-5d775f820f4c': ['visit-the-oval-office'],
            },
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: '6m3q5dsoej',
            EntryId: 'tour-the-whitehouse',
            Milestones: [
              {
                id: 'visit-the-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
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
          robloxUserId: '7954006733',
          taskId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
          milestoneId: 'visit-the-oval-office',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      updatedCumulativePercentage: 50,
    });

    expect(dynamoMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':milestoneCompletions': {
            '14b8d408-c0a1-706f-f3f4-5d775f820f4c': ['visit-the-oval-office'],
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
            CognitoUserId: '14b8d408-c0a1-706f-f3f4-5d775f820f4c',
            Username: 'Google_112852293390088774335',
          },
        ],
      }),
    });

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
            ExperienceId: '6m3q5dsoej',
            CourseId: '810781632040',
            ItemId: '815849199683',
            AttachmentId: '815849744756',
            CreatedBy: 'f47874b8-e001-7099-7b8a-5d1792d6122b',
            EntryId: 'tour-the-whitehouse',
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: '6m3q5dsoej',
            EntryId: 'tour-the-whitehouse',
            Milestones: [
              {
                id: 'visit-the-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
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
          robloxUserId: '7954006733',
          taskId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
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
            CognitoUserId: '14b8d408-c0a1-706f-f3f4-5d775f820f4c',
            Username: 'Google_112852293390088774335',
          },
        ],
      }),
    });

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
            ExperienceId: '6m3q5dsoej',
            CourseId: '810781632040',
            ItemId: '815849199683',
            AttachmentId: '815849744756',
            CreatedBy: 'f47874b8-e001-7099-7b8a-5d1792d6122b',
            EntryId: 'tour-the-whitehouse',
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: '6m3q5dsoej',
            EntryId: 'tour-the-whitehouse',
            Milestones: [
              {
                id: 'visit-the-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
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
          robloxUserId: '7954006733',
          taskId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
          milestoneId: 'visit-the-oval-office',
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
          robloxUserId: '7954006733',
          taskId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
          milestoneId: 'visit-the-oval-office',
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
            CognitoUserId: '14b8d408-c0a1-706f-f3f4-5d775f820f4c',
            Username: 'Google_112852293390088774335',
          },
        ],
      }),
    });

    dynamoMocks.get
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            InstanceId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
            ExperienceId: '6m3q5dsoej',
            CourseId: '810781632040',
            ItemId: '815849199683',
            AttachmentId: '815849744756',
            CreatedBy: 'f47874b8-e001-7099-7b8a-5d1792d6122b',
            EntryId: 'tour-the-whitehouse',
          },
        }),
      })
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: '6m3q5dsoej',
            EntryId: 'tour-the-whitehouse',
            Milestones: [
              {
                id: 'visit-the-oval-office',
                name: 'Visit the Oval Office',
                percentageAwarded: 50,
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
          robloxUserId: '7954006733',
          taskId: '6461d2d2-6a96-490a-91f7-bbebb219f815',
          milestoneId: 'visit-the-oval-office',
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
