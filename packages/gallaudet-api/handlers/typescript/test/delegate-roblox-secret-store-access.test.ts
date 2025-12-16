import {
  DelegateRobloxSecretStoreAccessChainedRequestInput,
  InternalFailureErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { delegateRobloxSecretStoreAccess } from '../src/delegate-roblox-secret-store-access';

jest.mock('aws-sdk', () => {
  const getSecretValue = jest.fn();
  const update = jest.fn();
  const mockDocClient = jest.fn(() => ({ update }));
  const mockSecrets = jest.fn(() => ({ getSecretValue }));

  return {
    DynamoDB: { DocumentClient: mockDocClient },
    SecretsManager: mockSecrets,
    __mocks: { getSecretValue, update },
  };
});

jest.mock('gaxios', () => ({
  request: jest.fn(),
}));

const { getSecretValue, update } = (jest.requireMock('aws-sdk') as any).__mocks;
const gaxios = jest.requireMock('gaxios');

const baseRequest: Omit<DelegateRobloxSecretStoreAccessChainedRequestInput, 'input'> = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: { claims: { sub: 'cognito-user-123' } },
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
};

describe('DelegateRobloxSecretStoreAccess', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.OAUTH_TOKENS_TABLE_NAME = 'Tokens';
    process.env.ROBLOX_OAUTH_CLIENT_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123:secret';

    getSecretValue.mockReturnValue({
      promise: () =>
        Promise.resolve({
          SecretString: JSON.stringify({ clientId: 'roblox-client', clientSecret: 'roblox-secret' }),
        }),
    });

    update.mockReturnValue({ promise: () => Promise.resolve({}) });
  });

  it('exchanges code and stores tokens', async () => {
    gaxios.request.mockResolvedValue({
      status: 200,
      data: { access_token: 'access', refresh_token: 'refresh', scope: 'universe.secret:write' },
    });

    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      input: {
        requestParameters: {} as any,
        body: {
          code: 'roblox-code',
          code_verifier: 'verifier',
          redirect_uri: 'https://example.com/callback',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Success' });
    expect(gaxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://apis.roblox.com/oauth/v1/token',
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'Tokens',
        Key: { CognitoUserId: 'cognito-user-123', Provider: 'roblox' },
      }),
    );
  });

  it('returns not authorized when no user id is present', async () => {
    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      event: { requestContext: { authorizer: {} } } as any,
      input: { requestParameters: {} as any, body: { code: 'c', code_verifier: 'v', redirect_uri: 'u' } },
    });

    expect(response.statusCode).toBe(403);
  });

  it('handles missing access token from Roblox', async () => {
    gaxios.request.mockResolvedValue({ status: 200, data: {} });

    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      input: {
        requestParameters: {} as any,
        body: { code: 'c', code_verifier: 'v', redirect_uri: 'u' },
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toBe(
      'Failed to exchange authorization code for tokens',
    );
  });
});
