process.env.PROJECTS_TABLE_NAME = 'Projects';
process.env.USERS_TABLE_NAME = 'Users';

import {
  InternalFailureErrorResponseContent,
  ListProjectsChainedRequestInput,
  NotAuthorizedErrorResponseContent,
  RobloxLinkRequiredErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { listProjects } from '../src/list-projects';
import { getCognitoUserIdFromEvent, getRobloxUserIdForCognitoUser } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
  getRobloxUserIdForCognitoUser: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const getPromise = jest.fn();
  const queryPromise = jest.fn();
  const get = jest.fn(() => ({
    promise: getPromise,
  }));
  const query = jest.fn(() => ({
    promise: queryPromise,
  }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get,
        query,
      })),
    },
    __mocks: {
      dynamo: {
        get,
        getPromise,
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
      get: jest.Mock;
      getPromise: jest.Mock;
      query: jest.Mock;
      queryPromise: jest.Mock;
    };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;
const mockedGetRobloxUserIdForCognitoUser = getRobloxUserIdForCognitoUser as jest.Mock;

// Common request arguments
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
    mockedGetRobloxUserIdForCognitoUser.mockResolvedValue('roblox-456');
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

  it('returns 403 when no Roblox account is linked', async () => {
    const notLinkedError = Object.assign(new Error('No Roblox user id'), {
      name: 'RobloxUserNotLinkedError',
    });
    mockedGetRobloxUserIdForCognitoUser.mockRejectedValueOnce(notLinkedError);

    const response = await listProjects({
      ...requestArguments,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as RobloxLinkRequiredErrorResponseContent).message,
    ).toEqual('No Roblox User ID linked to Cognito user ID: cognito-user-123.');
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
    expect(mockedGetRobloxUserIdForCognitoUser).toHaveBeenCalledWith(
      'cognito-user-123',
    );
    expect(dynamoMocks.query).toHaveBeenCalledWith({
      TableName: 'Projects',
      IndexName: 'ProjectCreatorRobloxUserIdIndex',
      KeyConditionExpression: '#creatorId = :creatorId',
      ExpressionAttributeNames: {
        '#creatorId': 'ProjectCreatorRobloxUserId',
      },
      ExpressionAttributeValues: {
        ':creatorId': 'roblox-456',
      },
    });
  });

  it('returns projects for the linked Roblox user', async () => {
    dynamoMocks.queryPromise.mockResolvedValueOnce({
      Items: [
        { ExperienceId: 'exp-1', ProjectCreatorRobloxUserId: 'roblox-456' },
        { ExperienceId: 'exp-2', ProjectCreatorRobloxUserId: 'roblox-456' },
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
