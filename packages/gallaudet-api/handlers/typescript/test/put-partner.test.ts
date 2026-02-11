process.env.PARTNERS_TABLE_NAME = 'Partners';

import {
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  PutPartnerChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import { putPartner } from '../src/put-partner';
import { getPartnerIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => {
  const actual = jest.requireActual('../src/utils/auth-utils');
  return {
    ...actual,
    getPartnerIdFromEvent: jest.fn(),
  };
});

jest.mock('aws-sdk', () => {
  const updatePromise = jest.fn();
  const update = jest.fn(() => ({
    promise: updatePromise,
  }));

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        update,
      })),
    },
    __mock: {
      update,
      updatePromise,
    },
  };
});

const { __mock: dynamoMocks } = jest.requireMock('aws-sdk') as {
  __mock: {
    update: jest.Mock;
    updatePromise: jest.Mock;
  };
};

const mockedGetPartnerIdFromEvent = getPartnerIdFromEvent as jest.Mock;

const buildRequestArgs = (
  overrides: Partial<PutPartnerChainedRequestInput> = {},
) =>
  ({
    chain: undefined as never,
    event: ({
      requestContext: {
        identity: {
          apiKeyId: 'api-key-123',
        },
      },
    }) as any,
    context: {} as any,
    interceptorContext: {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    ...overrides,
  }) as Omit<PutPartnerChainedRequestInput, 'input'>;

beforeEach(() => {
  if (!dynamoMocks) {
    throw new Error('DynamoDB mocks were not initialised');
  }
  jest.clearAllMocks();
  dynamoMocks.updatePromise.mockResolvedValue({});
  mockedGetPartnerIdFromEvent.mockResolvedValue('9228429469');
});

describe('PutPartner', () => {
  it('returns 403 when API key is missing', async () => {
    mockedGetPartnerIdFromEvent.mockRejectedValueOnce(
      new Error('API key identifier not parseable from event.'),
    );
    const response = await putPartner({
      ...buildRequestArgs({
        event: { requestContext: { identity: {} } } as any,
      }),
      input: {
        requestParameters: {},
        body: {
          partnerName: 'NUSA',
          robloxGameId: '12345',
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Valid API key required');
    expect(dynamoMocks.update).not.toHaveBeenCalled();
  });

  it('persists the partner profile and returns success', async () => {
    const response = await putPartner({
      ...buildRequestArgs(),
      input: {
        requestParameters: {},
        body: {
          partnerName: '  National USA Game ',
          robloxGameId: '  1213026131 ',
        },
      },
    });

    expect(dynamoMocks.update).toHaveBeenCalledTimes(1);
    const updateArgs = dynamoMocks.update.mock.calls[0]?.[0];
    if (!updateArgs) {
      throw new Error('Expected DynamoDB update arguments to be provided');
    }
    expect(updateArgs.TableName).toBe('Partners');
    expect(updateArgs.Key).toEqual({
      PartnerId: '9228429469',
    });
    expect(updateArgs.ExpressionAttributeValues).toMatchObject({
      ':partnerName': 'National USA Game',
      ':robloxGameId': '1213026131',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Partner profile saved',
    });
  });

  it('returns 500 when DynamoDB returns an error', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
    });
    dynamoMocks.updatePromise.mockRejectedValueOnce(dynamoError);

    const response = await putPartner({
      ...buildRequestArgs(),
      input: {
        requestParameters: {},
        body: {
          partnerName: 'NUSA',
          robloxGameId: '123456',
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual('Failed to save partner profile');
  });
});
