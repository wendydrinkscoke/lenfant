process.env.PARTNERS_TABLE_NAME = 'Partners';
process.env.PARTNERS_V2_TABLE_NAME = 'PartnersV2';

import {
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  PutPartnerChainedRequestInput,
  PutPartnerRequestContent,
} from 'gallaudet-api-typescript-runtime';
import { putPartner } from '../src/put-partner';

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

type PutPartnerBody = PutPartnerRequestContent & {
  experienceId?: string;
};

beforeEach(() => {
  if (!dynamoMocks) {
    throw new Error('DynamoDB mocks were not initialised');
  }
  jest.clearAllMocks();
  dynamoMocks.updatePromise.mockResolvedValue({});
});

describe('PutPartner', () => {
  it('returns 403 when API key is missing', async () => {
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

  it('persists the partner profile in both tables and returns success', async () => {
    const response = await putPartner({
      ...buildRequestArgs(),
      input: {
        requestParameters: {},
        body: {
          partnerName: '  National USA Game ',
          robloxGameId: '  1213026131 ',
          experienceId: '  98765 ',
        } as PutPartnerBody,
      },
    });

    expect(dynamoMocks.update).toHaveBeenCalledTimes(2);
    const partnersUpdateArgs = dynamoMocks.update.mock.calls[0]?.[0];
    const partnersV2UpdateArgs = dynamoMocks.update.mock.calls[1]?.[0];

    expect(partnersUpdateArgs?.TableName).toBe('Partners');
    expect(partnersUpdateArgs?.Key).toEqual({
      PartnerId: 'api-key-123',
    });
    expect(partnersUpdateArgs?.ExpressionAttributeValues).toMatchObject({
      ':partnerName': 'National USA Game',
      ':robloxGameId': '1213026131',
    });

    expect(partnersV2UpdateArgs?.TableName).toBe('PartnersV2');
    expect(partnersV2UpdateArgs?.Key).toEqual({
      ExperienceId: '98765',
    });
    expect(partnersV2UpdateArgs?.ExpressionAttributeValues).toMatchObject({
      ':partnerName': 'National USA Game',
      ':robloxGameId': '1213026131',
      ':partnerId': 'api-key-123',
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
