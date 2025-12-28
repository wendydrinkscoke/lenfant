process.env.ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME = 'RobloxExperienceApiKeys';

import {
  DelegateRobloxSecretStoreAccessChainedRequestInput,
  InternalFailureErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { delegateRobloxSecretStoreAccess } from '../src/delegate-roblox-secret-store-access';

jest.mock('aws-sdk', () => {
  const put = jest.fn();
  return {
    DynamoDB: { DocumentClient: jest.fn(() => ({ put })) },
    __mocks: { put },
  };
});

const { put } = (jest.requireMock('aws-sdk') as any).__mocks;

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

    put.mockReturnValue({ promise: () => Promise.resolve({}) });
  });

  it('stores API key for an experience', async () => {
    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      input: {
        requestParameters: {} as any,
        body: {
          apiKey: 'roblox-api-key',
          experienceId: '1234567890',
        } as any,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Success' });
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'RobloxExperienceApiKeys',
        Item: expect.objectContaining({
          ExperienceId: '1234567890',
          ApiKey: 'roblox-api-key',
          KeyCreatorCognitoUserId: 'cognito-user-123',
        }),
      }),
    );
  });

  it('returns bad request when parameters are missing', async () => {
    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      input: { requestParameters: {} as any, body: { apiKey: '', experienceId: '' } as any },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns not authorized when no user id is present', async () => {
    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      event: { requestContext: { authorizer: {} } } as any,
      input: { requestParameters: {} as any, body: { apiKey: 'k', experienceId: '1' } as any },
    });

    expect(response.statusCode).toBe(403);
  });

  it('handles DynamoDB failures', async () => {
    put.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('ddb error')),
    });

    const response = await delegateRobloxSecretStoreAccess({
      ...baseRequest,
      input: {
        requestParameters: {} as any,
        body: { apiKey: 'key', experienceId: '1' } as any,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toContain(
      'Failed to store API key',
    );
  });
});
