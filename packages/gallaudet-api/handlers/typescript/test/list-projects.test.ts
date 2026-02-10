process.env.PROJECTS_TABLE_NAME = 'Projects';

import {
  InternalFailureErrorResponseContent,
  ListProjectsChainedRequestInput,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { listProjects } from '../src/list-projects';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const queryPromise = jest.fn();
  const query = jest.fn(() => ({
    promise: queryPromise,
  }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query,
      })),
    },
    __mocks: {
      dynamo: {
        query,
        queryPromise,
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
      queryPromise: jest.Mock;
    };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;

const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: 'cognito-user-123',
        },
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
} satisfies Omit<ListProjectsChainedRequestInput, 'input'>;

describe('ListProjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.queryPromise.mockResolvedValue({ Items: [] });
  });

  it('returns 403 when no authenticated user is found', async () => {
    mockedGetCognitoUserIdFromEvent.mockImplementation(() => {
      throw new Error('Cognito User ID not parseable from event.');
    });

    const response = await listProjects({
      ...requestArguments,
      event: { requestContext: {} } as any,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Authentication required',
    );
    expect(dynamoMocks.query).not.toHaveBeenCalled();
  });

  it('returns an empty list when no projects are found', async () => {
    dynamoMocks.queryPromise.mockResolvedValueOnce({
      Items: [],
    });

    const response = await listProjects({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      projects: [],
    });
    expect(dynamoMocks.query).toHaveBeenCalledWith({
      TableName: 'Projects',
      KeyConditionExpression: '#cognitoUserId = :cognitoUserId',
      ExpressionAttributeNames: {
        '#cognitoUserId': 'CognitoUserId',
      },
      ExpressionAttributeValues: {
        ':cognitoUserId': 'cognito-user-123',
      },
    });
  });

  it('returns projects for the calling Cognito user', async () => {
    dynamoMocks.queryPromise.mockResolvedValueOnce({
      Items: [
        { ExperienceId: 'exp-1', CognitoUserId: 'cognito-user-123' },
        { ExperienceId: 'exp-2', CognitoUserId: 'cognito-user-123' },
      ],
    });

    const response = await listProjects({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      projects: [{ experienceId: 'exp-1' }, { experienceId: 'exp-2' }],
    });
  });

  it('returns 500 when the projects query fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
      message: 'Throughput exceeded',
    });
    dynamoMocks.queryPromise.mockRejectedValueOnce(dynamoError);

    const response = await listProjects({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to list projects.',
    );
  });
});
