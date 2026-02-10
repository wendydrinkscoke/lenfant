process.env.ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME = 'RobloxExperienceApiKeys';
process.env.PARTNER_API_KEY_USAGE_PLAN_NAME = 'partner-api-key-usage-plan-beta';
process.env.SECRET_DOMAIN = 'beta.school.civictech.llc';

import {
  InternalFailureErrorResponseContent,
  MissingRequiredRobloxOAuthScopesResponseContent,
  SecretAlreadyExistsErrorResponseContent,
  VendSecretChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import { sealedbox } from 'tweetnacl-ts';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-ts/convert';
import { vendSecret } from '../src/vend-secret';

jest.mock('aws-sdk', () => {
  const get = jest.fn();
  const createApiKey = jest.fn();
  const createUsagePlanKey = jest.fn();
  const getUsagePlans = jest.fn();
  const deleteUsagePlanKey = jest.fn();
  const deleteApiKey = jest.fn();
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({ get })),
    },
    APIGateway: jest.fn(() => ({
      createApiKey,
      createUsagePlanKey,
      getUsagePlans,
      deleteUsagePlanKey,
      deleteApiKey,
    })),
    __mocks: {
      get,
      createApiKey,
      createUsagePlanKey,
      getUsagePlans,
      deleteUsagePlanKey,
      deleteApiKey,
    },
  };
});

jest.mock('tweetnacl-ts', () => ({
  sealedbox: jest.fn(),
}));

jest.mock('tweetnacl-ts/convert', () => ({
  decodeBase64: jest.fn(),
  decodeUTF8: jest.fn(),
  encodeBase64: jest.fn(),
}));

const {
  __mocks: {
    get,
    createApiKey,
    createUsagePlanKey,
    getUsagePlans,
    deleteUsagePlanKey,
    deleteApiKey,
  },
} = jest.requireMock('aws-sdk') as {
  __mocks: {
    get: jest.Mock;
    createApiKey: jest.Mock;
    createUsagePlanKey: jest.Mock;
    getUsagePlans: jest.Mock;
    deleteUsagePlanKey: jest.Mock;
    deleteApiKey: jest.Mock;
  };
};

const sealedboxMock = sealedbox as jest.Mock;
const decodeBase64Mock = decodeBase64 as jest.Mock;
const decodeUTF8Mock = decodeUTF8 as jest.Mock;
const encodeBase64Mock = encodeBase64 as jest.Mock;

const fetchMock = jest.fn();
const baseRequest: Omit<VendSecretChainedRequestInput, 'input'> = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: { sub: 'cognito-user-123' },
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
};

const buildRequest = (experienceId = '9228429469') => ({
  ...baseRequest,
  input: {
    requestParameters: {
      experienceId,
    },
    body: undefined as never,
  },
});

const buildFetchResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  json: jest.fn().mockResolvedValue(data),
});

describe('VendSecret', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as typeof globalThis & { fetch: jest.Mock }).fetch = fetchMock;
    fetchMock.mockReset();

    get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Item: { ApiKey: 'roblox-api-key' },
      }),
    });
    createApiKey.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        id: 'api-key-id',
        value: 'api-key-value',
      }),
    });
    getUsagePlans.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        items: [{ id: 'usage-plan-123', name: 'partner-api-key-usage-plan-beta' }],
      }),
    });
    createUsagePlanKey.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
    deleteUsagePlanKey.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
    deleteApiKey.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    decodeUTF8Mock.mockReturnValue(new Uint8Array([1]));
    decodeBase64Mock.mockReturnValue(new Uint8Array([2]));
    sealedboxMock.mockReturnValue(new Uint8Array([3]));
    encodeBase64Mock.mockReturnValue('encrypted-api-key');
  });

  it('creates, encrypts, and stores a secret for the experience', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse({ secret: 'public-key', key_id: 'key-123' }))
      .mockResolvedValueOnce(buildFetchResponse({ id: 'secret-id' }, true, 200));

    const response = await vendSecret(buildRequest('1234567890'));

    expect(response.statusCode).toBe(200);
    const secretId = (response.body as { secretId: string }).secretId;
    expect(secretId).toMatch(/^[a-z]{12}$/);
    expect(get).toHaveBeenCalledWith({
      TableName: 'RobloxExperienceApiKeys',
      Key: {
        CognitoUserId: 'cognito-user-123',
        ExperienceId: '1234567890',
      },
      ConsistentRead: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://apis.roblox.com/cloud/v2/universes/1234567890/secrets/public-key',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'roblox-api-key',
        }),
      }),
    );

    expect(createUsagePlanKey).toHaveBeenCalledWith({
      keyId: 'api-key-id',
      keyType: 'API_KEY',
      usagePlanId: 'usage-plan-123',
    });
    expect(getUsagePlans).toHaveBeenCalled();

    const secretCall = fetchMock.mock.calls[1];
    expect(secretCall[0]).toBe(
      'https://apis.roblox.com/cloud/v2/universes/1234567890/secrets',
    );
    const secretPayload = JSON.parse(secretCall[1].body as string);
    expect(secretPayload).toEqual({
      id: secretId,
      secret: 'encrypted-api-key',
      key_id: 'key-123',
      domain: 'beta.school.civictech.llc',
    });
  });

  it('returns missing delegation when no API key is stored', async () => {
    get.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    const response = await vendSecret(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as MissingRequiredRobloxOAuthScopesResponseContent).message).toContain(
      'secret store access has not been delegated',
    );
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('propagates Roblox 403 as missing delegation', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue(JSON.stringify({})),
      json: jest.fn().mockResolvedValue({}),
    });

    const response = await vendSecret(buildRequest());

    expect(response.statusCode).toBe(403);
    expect((response.body as MissingRequiredRobloxOAuthScopesResponseContent).message).toContain(
      'secret store access has not been delegated',
    );
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('returns SecretAlreadyExistsError when Roblox reports a conflict and cleans up the key', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse({ secret: 'public-key', key_id: 'key-123' }))
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: jest.fn().mockResolvedValue('Secret already exists.'),
        json: jest.fn().mockResolvedValue({}),
      });

    const response = await vendSecret(buildRequest());

    expect(response.statusCode).toBe(409);
    expect((response.body as SecretAlreadyExistsErrorResponseContent).message).toContain(
      'Secret already exists',
    );
    expect(deleteUsagePlanKey).toHaveBeenCalledWith({
      usagePlanId: 'usage-plan-123',
      keyId: 'api-key-id',
    });
    expect(deleteApiKey).toHaveBeenCalledWith({ apiKey: 'api-key-id' });
  });

  it('returns internal failure when Roblox rejects secret creation and cleans up', async () => {
    fetchMock
      .mockResolvedValueOnce(buildFetchResponse({ secret: 'public-key', key_id: 'key-123' }))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Domain is not valid.'),
        json: jest.fn().mockResolvedValue({}),
      });

    const response = await vendSecret(buildRequest());

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toContain('Failed to store secret');
    expect(deleteApiKey).toHaveBeenCalledWith({ apiKey: 'api-key-id' });
  });
});
