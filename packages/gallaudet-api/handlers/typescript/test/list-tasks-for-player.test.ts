process.env.TASK_INSTANCE_TABLE_NAME = 'TaskInstances';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';
process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'secretArn';
process.env.USERS_TABLE_NAME = 'Users';

import {
  ListTasksForPlayerChainedRequestInput,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { listTasksForPlayer } from '../src/list-tasks-for-player';
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
  const scan = jest.fn();
  const put = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query,
        scan,
        put,
      })),
    },
    __mocks: {
      dynamo: {
        query,
        scan,
        put,
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

const baseRequestArgs = {
  chain: undefined as never,
  event: {
    requestContext: {
      identity: {
        apiKeyId: 'partner-key-1',
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
  coursesListMock.mockReset();
  courseWorkListMock.mockReset();
  addOnAttachmentsListMock.mockReset();
  (getGoogleOAuthClient as jest.Mock).mockReset();
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
            apiKeyId: 'partner-key-1',
          },
        },
      } as any),
    ...overrides,
  }) as Omit<ListTasksForPlayerChainedRequestInput, 'input'>;

describe('ListTasksForPlayer', () => {
  it('returns 403 when the API key is missing', async () => {
    const response = await listTasksForPlayer({
      ...buildRequestArgs({
        event: { requestContext: { identity: {} } } as any,
      }),
      input: {
        requestParameters: {
          robloxUserId: '12345',
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
          robloxUserId: '12345',
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
        ':robloxUserId': '12345',
      },
      Limit: 1,
      ConsistentRead: false,
    });
  });

  it('returns tasks when submissions reference partner attachments', async () => {
    dynamoMocks.query.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            CognitoUserId: 'cognito-user-1',
          },
        ],
      }),
    });
    (getGoogleOAuthClient as jest.Mock).mockResolvedValue({});

    coursesListMock.mockReturnValue({
      data: {
        courses: [{ id: 'course-1' }],
      },
    });

    courseWorkListMock.mockReturnValue({
      data: {
        courseWork: [{ id: 'cw-1' }],
      },
    });

    addOnAttachmentsListMock.mockReturnValue({
      data: {
        addOnAttachments: [
          {
            id: 'attachment-1',
          },
        ],
      },
    });

    dynamoMocks.query.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Items: [
          {
            InstanceId: 'task-123',
            EntryId: 'catalog-entry-1',
            PartnerId: 'partner-key-1',
            AttachmentId: 'attachment-1',
          },
        ],
      }),
    });

    const response = await listTasksForPlayer({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          robloxUserId: '12345',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      tasks: [
        {
          taskId: 'task-123',
          entryId: 'catalog-entry-1',
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
        ':attachmentId': 'attachment-1',
      },
      Limit: 1,
      ConsistentRead: false,
    });
    expect(dynamoMocks.scan).not.toHaveBeenCalled();
  });
});
