process.env.EXPERIENCES_TABLE_NAME = 'Experiences';

import {
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
  PutExperienceChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import { putExperience } from '../src/put-experience';
import { getExperienceIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => {
  const actual = jest.requireActual('../src/utils/auth-utils');
  return {
    ...actual,
    getExperienceIdFromEvent: jest.fn(),
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

const mockedGetExperienceIdFromEvent = getExperienceIdFromEvent as jest.Mock;

const buildRequestArgs = (
  overrides: Partial<PutExperienceChainedRequestInput> = {},
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
  }) as Omit<PutExperienceChainedRequestInput, 'input'>;

beforeEach(() => {
  if (!dynamoMocks) {
    throw new Error('DynamoDB mocks were not initialised');
  }
  jest.clearAllMocks();
  dynamoMocks.updatePromise.mockResolvedValue({});
  mockedGetExperienceIdFromEvent.mockResolvedValue('9228429469');
});

describe('PutExperience', () => {
  it('returns 403 when API key is missing', async () => {
    mockedGetExperienceIdFromEvent.mockRejectedValueOnce(
      new Error('API key identifier not parseable from event.'),
    );
    const response = await putExperience({
      ...buildRequestArgs({
        event: { requestContext: { identity: {} } } as any,
      }),
      input: {
        requestParameters: {},
        body: {
          experienceName: 'NUSA',
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

  it('persists the experience profile and returns success', async () => {
    const response = await putExperience({
      ...buildRequestArgs(),
      input: {
        requestParameters: {},
        body: {
          experienceName: '  National USA Game ',
          robloxGameId: '  1213026131 ',
          assetIds: [
            'f8a2ab54-30f7-406f-af10-b1591db54b91',
          ],
        },
      },
    });

    expect(dynamoMocks.update).toHaveBeenCalledTimes(1);
    const updateArgs = dynamoMocks.update.mock.calls[0]?.[0];
    if (!updateArgs) {
      throw new Error('Expected DynamoDB update arguments to be provided');
    }
    expect(updateArgs.TableName).toBe('Experiences');
    expect(updateArgs.Key).toEqual({
      ExperienceId: '9228429469',
    });
    expect(updateArgs.ExpressionAttributeValues).toMatchObject({
      ':experienceName': 'National USA Game',
      ':robloxGameId': '1213026131',
      ':assetIds': [
        'f8a2ab54-30f7-406f-af10-b1591db54b91',
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Experience profile saved',
    });
  });

  it('returns 500 when DynamoDB returns an error', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
    });
    dynamoMocks.updatePromise.mockRejectedValueOnce(dynamoError);

    const response = await putExperience({
      ...buildRequestArgs(),
      input: {
        requestParameters: {},
        body: {
          experienceName: 'NUSA',
          robloxGameId: '123456',
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual('Failed to save experience profile');
  });

  it('returns 400 when duplicate assetIds are provided', async () => {
    const response = await putExperience({
      ...buildRequestArgs(),
      input: {
        requestParameters: {},
        body: {
          experienceName: 'NUSA',
          robloxGameId: '123456',
          assetIds: [
            'eca23e44-4d2f-4061-88d8-b5d94339d8ad',
            'eca23e44-4d2f-4061-88d8-b5d94339d8ad',
          ],
        } as any,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: 'Duplicate assetId eca23e44-4d2f-4061-88d8-b5d94339d8ad',
    });
    expect(dynamoMocks.update).not.toHaveBeenCalled();
  });
});
