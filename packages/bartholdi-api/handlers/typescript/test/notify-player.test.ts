import {
  NotFoundErrorResponseContent,
  NotifyPlayerChainedRequestInput,
} from 'bartholdi-api-typescript-runtime';
import {
  notifyPlayer,
} from '../src/notify-player';

jest.mock('aws-sdk', () => ({
  CognitoIdentityServiceProvider: jest.fn(() => ({
    listUsers: jest.fn(() => ({
      promise: jest.fn().mockResolvedValue({ Users: [] }),
    })),
  })),
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      query: jest.fn(() => ({
        promise: jest.fn().mockResolvedValue({}),
      })),
    })),
  },
  SecretsManager: jest.fn(() => ({
    getSecretValue: jest.fn(() => ({
      promise: jest.fn().mockResolvedValue({}),
    })),
  })),
}));

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {} as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  },
} satisfies Omit<NotifyPlayerChainedRequestInput, 'input'>;

describe('NotifyPlayer', () => {

  beforeEach(() => {
    process.env.USER_POOL_ID = 'test-user-pool-id';
  });

  it('should return not found when no matching Cognito user exists', async () => {
    const response = await notifyPlayer({
      ...requestArguments,
      input: {
        requestParameters: { playerId: '12345' },
        body: {
          title: 'Hello',
          subtitle: 'World',
          body: 'Test notification',
        },
      },
    });

    expect(response.statusCode).toBe(404);
    expect((response.body as NotFoundErrorResponseContent).message).toBe(
      'No Cognito user found for player',
    );
  });

});
