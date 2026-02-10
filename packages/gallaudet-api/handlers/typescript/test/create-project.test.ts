process.env.PROJECTS_TABLE_NAME = 'Projects';

import {
  CreateProjectChainedRequestInput,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  ProjectAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { createProject } from '../src/create-project';
import { getCognitoUserIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => ({
  getCognitoUserIdFromEvent: jest.fn(),
}));

jest.mock('aws-sdk', () => {
  const put = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({ put })),
    },
    __mocks: {
      dynamo: {
        put,
      },
    },
  };
});

const {
  __mocks: { dynamo: dynamoMocks },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    dynamo: { put: jest.Mock };
  };
};

const mockedGetCognitoUserIdFromEvent = getCognitoUserIdFromEvent as jest.Mock;

const requestArguments = {
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
} satisfies Omit<CreateProjectChainedRequestInput, 'input'>;

const buildRequest = (experienceId = '1234567890') => ({
  ...requestArguments,
  input: {
    requestParameters: {
      experienceId,
    },
    body: undefined as never,
  },
});

describe('CreateProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCognitoUserIdFromEvent.mockReturnValue('cognito-user-123');
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
  });

  it('returns not authorized when no authenticated user is present', async () => {
    mockedGetCognitoUserIdFromEvent.mockImplementation(() => {
      throw new Error('Cognito User ID not parseable from event.');
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as NotAuthorizedErrorResponseContent).message).toEqual(
      'Authentication required',
    );
    expect(dynamoMocks.put).not.toHaveBeenCalled();
  });

  it('creates a project scoped to the calling Cognito user', async () => {
    const response = await createProject(buildRequest('9876543210'));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Project created successfully.',
    });
    expect(dynamoMocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'Projects',
        ConditionExpression:
          'attribute_not_exists(CognitoUserId) AND attribute_not_exists(ExperienceId)',
        Item: expect.objectContaining({
          CognitoUserId: 'cognito-user-123',
          ExperienceId: '9876543210',
          CreatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('returns a conflict when the user already created a project for the experience', async () => {
    const conditionalCheckFailedError = Object.assign(
      new Error('Conditional request failed'),
      { code: 'ConditionalCheckFailedException' },
    );
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockRejectedValue(conditionalCheckFailedError),
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(409);
    expect(
      (response.body as ProjectAlreadyExistsErrorResponseContent).message,
    ).toEqual(
      'A project for experienceId 1234567890 already exists for this user.',
    );
  });

  it('returns internal failure when the project write fails', async () => {
    dynamoMocks.put.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('ddb error')),
    });

    const response = await createProject(buildRequest());

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual(
      'Failed to create new project entry in the database.',
    );
  });
});
