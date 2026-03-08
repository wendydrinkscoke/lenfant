process.env.TASK_INSTANCE_TABLE_NAME = 'TaskInstances';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';
process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'secretArn';
process.env.USERS_TABLE_NAME = 'Users';
process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';

import {
  ListTasksForPlayerChainedRequestInput,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { listTasksForPlayer } from '../src/list-tasks-for-player';
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
  const scan = jest.fn();
  const put = jest.fn();
  const get = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query,
        scan,
        put,
        get,
      })),
    },
    __mocks: {
      dynamo: {
        query,
        scan,
        put,
        get,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: {
      query: jest.Mock;
      scan: jest.Mock;
      put: jest.Mock;
      get: jest.Mock;
    };
  };
};

jest.mock('@googleapis/classroom', () => {
  const coursesListMock = jest.fn();
  const courseWorkListMock = jest.fn();
  const addOnAttachmentsListMock = jest.fn();
  return {
    classroom: jest.fn(() => ({
      courses: {
        list: coursesListMock,
        courseWork: {
          list: courseWorkListMock,
        },
        courseWorkMaterials: {
          addOnAttachments: {
            list: addOnAttachmentsListMock,
          },
        },
      },
    })),
    __mocks: {
      coursesListMock,
      courseWorkListMock,
      addOnAttachmentsListMock,
    },
  };
});

const {
  __mocks: {
    coursesListMock,
    courseWorkListMock,
    addOnAttachmentsListMock,
  },
} = jest.requireMock('@googleapis/classroom') as {
  __mocks: {
    coursesListMock: jest.Mock;
    courseWorkListMock: jest.Mock;
    addOnAttachmentsListMock: jest.Mock;
  };
};
const COURSE_WORK_ID = '844809637151';
const ENTRY_ID = 'get-100-points';

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
      debug: jest.fn(),
    },
  },
} satisfies Omit<ListTasksForPlayerChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  dynamoMocks.query.mockReset();
  dynamoMocks.scan.mockReset();
  dynamoMocks.put.mockReset();
  dynamoMocks.get.mockReset();
  coursesListMock.mockReset();
  courseWorkListMock.mockReset();
  addOnAttachmentsListMock.mockReset();
  (getGoogleOAuthClient as jest.Mock).mockReset();
  (getExperienceIdFromEvent as jest.Mock).mockReset();
  (getExperienceIdFromEvent as jest.Mock).mockResolvedValue('9228429469');
});

const buildRequestArgs = (
  overrides: Partial<ListTasksForPlayerChainedRequestInput> = {},
) =>
  ({
    ...baseRequestArgs,
    event:
      overrides.event ??
      ({
        requestContext: {
          identity: {
            apiKeyId: 'f2ouqfm233',
          },
        },
      } as any),
    ...overrides,
  }) as Omit<ListTasksForPlayerChainedRequestInput, 'input'>;

describe('ListTasksForPlayer', () => {
  it('returns 403 when the API key is missing', async () => {
    (getExperienceIdFromEvent as jest.Mock).mockRejectedValueOnce(
      new Error('API key identifier not parseable from event.'),
    );
    const response = await listTasksForPlayer({
      ...buildRequestArgs({
        event: { requestContext: { identity: {} } } as any,
      }),
      input: {
        requestParameters: {
          robloxUserId: '7954006733',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Valid API key required');
    expect(dynamoMocks.query).not.toHaveBeenCalled();
  });

  it('returns an empty list when the Roblox player is not linked', async () => {
    dynamoMocks.query.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [],
      }),
    });

    const response = await listTasksForPlayer({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: '7954006733',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ tasks: [] });
    expect(dynamoMocks.query).toHaveBeenCalledWith({
      TableName: 'Users',
      IndexName: 'RobloxUserIdIndex',
      KeyConditionExpression: '#robloxUserId = :robloxUserId',
      ExpressionAttributeNames: {
        '#robloxUserId': 'RobloxUserId',
      },
      ExpressionAttributeValues: {
        ':robloxUserId': '7954006733',
      },
      Limit: 1,
      ConsistentRead: false,
    });
  });

  it('returns tasks when submissions reference experience attachments', async () => {
    dynamoMocks.query.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
          },
        ],
      }),
    });
    (getGoogleOAuthClient as jest.Mock).mockResolvedValue({});

    coursesListMock.mockReturnValue({
      data: {
        courses: [{ id: '810781632040' }],
      },
    });

    courseWorkListMock.mockReturnValue({
      data: {
        courseWork: [{ id: COURSE_WORK_ID }],
      },
    });

    addOnAttachmentsListMock.mockReturnValue({
      data: {
        addOnAttachments: [
          {
            id: '844810086236',
          },
        ],
      },
    });

    dynamoMocks.query.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            InstanceId: '35188e83-4c18-4138-9352-0c878422cc30',
            EntryId: ENTRY_ID,
            ExperienceId: '9228429469',
            AttachmentId: '844810086236',
            MilestoneCompletions: {
              '3448c4d8-70e1-703a-6450-fbf81e4d71b4': ['visit-oval-office'],
            },
            Instructions: 'To do this task, you need to do a thing.',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Item: {
          ExperienceId: '9228429469',
          EntryId: ENTRY_ID,
          Name: 'Tour the White House',
          Subheading: 'Explore iconic rooms and history',
          Instructions: 'To do this task, you need to do a thing.',
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

    const response = await listTasksForPlayer({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: '7954006733',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      tasks: [
        {
          taskId: '35188e83-4c18-4138-9352-0c878422cc30',
          entryId: ENTRY_ID,
          name: 'Tour the White House',
          subheading: 'Explore iconic rooms and history',
          instructions: 'To do this task, you need to do a thing.',
          cumulativePercentage: 40,
          nextMilestone: {
            id: 'visit-situation-room',
            name: 'Visit the Situation Room',
            percentageContribution: 60,
          },
        },
      ],
    });
    expect(dynamoMocks.query).toHaveBeenNthCalledWith(2, {
      TableName: 'TaskInstances',
      IndexName: 'AttachmentIdIndex',
      KeyConditionExpression: '#attachmentId = :attachmentId',
      ExpressionAttributeNames: {
        '#attachmentId': 'AttachmentId',
      },
      ExpressionAttributeValues: {
        ':attachmentId': '844810086236',
      },
      Limit: 1,
      ConsistentRead: false,
    });
    expect(dynamoMocks.get).toHaveBeenCalledWith({
      TableName: 'TaskCatalog',
      Key: {
        ExperienceId: '9228429469',
        EntryId: ENTRY_ID,
      },
    });
    expect(dynamoMocks.scan).not.toHaveBeenCalled();
  });

  it('includes cumulativePercentage when a milestone task has no completions', async () => {
    dynamoMocks.query.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
          },
        ],
      }),
    });
    (getGoogleOAuthClient as jest.Mock).mockResolvedValue({});

    coursesListMock.mockReturnValue({
      data: {
        courses: [{ id: '810781632040' }],
      },
    });

    courseWorkListMock.mockReturnValue({
      data: {
        courseWork: [{ id: COURSE_WORK_ID }],
      },
    });

    addOnAttachmentsListMock.mockReturnValue({
      data: {
        addOnAttachments: [
          {
            id: '844810086236',
          },
        ],
      },
    });

    dynamoMocks.query.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            InstanceId: '35188e83-4c18-4138-9352-0c878422cc30',
            EntryId: ENTRY_ID,
            ExperienceId: '9228429469',
            AttachmentId: '844810086236',
            Instructions: 'To do this task, you need to do a thing.',
          },
        ],
      }),
    });

    dynamoMocks.get.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Item: {
          ExperienceId: '9228429469',
          EntryId: ENTRY_ID,
          Name: 'Tour the White House',
          Subheading: 'Explore iconic rooms and history',
          Instructions: 'To do this task, you need to do a thing.',
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

    const response = await listTasksForPlayer({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: '7954006733',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      tasks: [
        {
          taskId: '35188e83-4c18-4138-9352-0c878422cc30',
          entryId: ENTRY_ID,
          name: 'Tour the White House',
          subheading: 'Explore iconic rooms and history',
          instructions: 'To do this task, you need to do a thing.',
          cumulativePercentage: 0,
          nextMilestone: {
            id: 'visit-oval-office',
            name: 'Visit the Oval Office',
            percentageContribution: 40,
          },
        },
      ],
    });
  });
});
