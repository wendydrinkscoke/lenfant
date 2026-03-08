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
const EXPERIENCE_ID = '9228429469';
const API_KEY =
  'vNSgD9p1Xkq2Ht7Rj4Lm0Bz8Yw3Qa6EcUf5Pi2CnSr9Td1Mv8Lo7Gh4Kx0Wp3Rb6Yt2Ju9AeCq5Nz1Fk';

const baseRequest: Omit<DelegateRobloxSecretStoreAccessChainedRequestInput, 'input'> = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: { claims: { sub: '3448c4d8-70e1-703a-6450-fbf81e4d71b4' } },
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
          apiKey: API_KEY,
          experienceId: EXPERIENCE_ID,
        } as any,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Success' });
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'RobloxExperienceApiKeys',
        Item: expect.objectContaining({
          CognitoUserId: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
          ExperienceId: EXPERIENCE_ID,
          ApiKey: API_KEY,
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
      input: { requestParameters: {} as any, body: { apiKey: API_KEY, experienceId: EXPERIENCE_ID } as any },
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
        body: { apiKey: API_KEY, experienceId: EXPERIENCE_ID } as any,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toContain(
      'Failed to store API key',
    );
  });
});
