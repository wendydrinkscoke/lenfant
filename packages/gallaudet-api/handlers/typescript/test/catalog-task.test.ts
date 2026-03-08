process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';

import {
  CatalogTaskChainedRequestInput,
  InternalFailureErrorResponseContent,
  NotAuthorizedErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { catalogTask } from '../src/catalog-task';
import { getExperienceIdFromEvent } from '../src/utils/auth-utils';

jest.mock('../src/utils/auth-utils', () => {
  const actual = jest.requireActual('../src/utils/auth-utils');
  return {
    ...actual,
    getExperienceIdFromEvent: jest.fn(),
  };
});

var dynamoMocks: {
  updatePromise: jest.Mock;
  update: jest.Mock;
};

jest.mock('aws-sdk', () => {
  const updatePromise = jest.fn();
  const update = jest.fn(() => ({
    promise: updatePromise,
  }));

  dynamoMocks = {
    updatePromise,
    update,
  };

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        update,
      })),
    },
  };
});

const buildRequestArgs = (
  overrides: Partial<CatalogTaskChainedRequestInput> = {},
) =>
  ({
    chain: undefined as never,
    event: ({
      requestContext: {
        identity: {
          apiKeyId: 'f2ouqfm233',
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
  }) as Omit<CatalogTaskChainedRequestInput, 'input'>;

const mockedGetExperienceIdFromEvent = getExperienceIdFromEvent as jest.Mock;

beforeEach(() => {
  if (!dynamoMocks) {
    throw new Error('DynamoDB mocks were not initialised');
  }
  jest.clearAllMocks();
  dynamoMocks.updatePromise.mockResolvedValue({});
  mockedGetExperienceIdFromEvent.mockResolvedValue('9228429469');
});

describe('CatalogTask', () => {
  it('returns 403 when API key is missing', async () => {
    mockedGetExperienceIdFromEvent.mockRejectedValueOnce(
      new Error('API key identifier not parseable from event.'),
    );
    const response = await catalogTask({
      ...buildRequestArgs({
        event: { requestContext: { identity: {} } } as any,
      }),
      input: {
        requestParameters: {
          entryId: 'draft-a-bill',
        },
        body: {
          name: 'Draft a Bill',
          subheading: 'Research and write legislation',
          instructions: 'Work together to draft your bill.',
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(
      (response.body as NotAuthorizedErrorResponseContent).message,
    ).toEqual('Valid API key required');
    expect(dynamoMocks.update).not.toHaveBeenCalled();
  });

  it('persists the catalog entry and returns success', async () => {
    const response = await catalogTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          entryId: 'draft-a-bill',
        },
        body: {
          name: 'Draft a Bill',
          subheading: 'Research and write legislation',
          instructions: 'Work together to draft your bill.',
        },
      },
    });

    expect(dynamoMocks.update).toHaveBeenCalledTimes(1);
    const updateCall = dynamoMocks.update.mock.calls[0] as any[] | undefined;
    if (!updateCall) {
      throw new Error('Expected DynamoDB update to be invoked');
    }
    const updateArgs = updateCall[0];
    if (!updateArgs) {
      throw new Error('Expected DynamoDB update arguments to be provided');
    }
    const updateArgsRecord = updateArgs as any;
    expect(updateArgsRecord.TableName).toBe('TaskCatalog');
    expect(updateArgsRecord.Key).toEqual({
      ExperienceId: '9228429469',
      EntryId: 'draft-a-bill',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Task catalog entry saved',
    });
  });

  it('persists milestones when provided', async () => {
    const response = await catalogTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          entryId: 'tour-the-whitehouse',
        },
        body: {
          name: 'Tour the Whitehouse',
          subheading: 'Explore iconic rooms and history',
          instructions: 'Complete each stop on your tour.',
          assetIds: [
            '94f5d18a-d91a-4d8f-954f-2d31cf212f68',
          ],
          milestones: [
            {
              id: 'visit-oval-office',
              name: 'Visit the Oval Office',
              percentageContribution: 50,
              assetIds: [
                'c8b70471-0f2a-4a40-a3f6-75b3f87c38af',
              ],
            },
            {
              id: 'visit-situation-room',
              name: 'Visit the Situation Room',
              percentageContribution: 50,
            },
          ],
        } as any,
      },
    });

    expect(response.statusCode).toBe(200);
    const updateCall = dynamoMocks.update.mock.calls[0] as any[] | undefined;
    if (!updateCall) {
      throw new Error('Expected DynamoDB update to be invoked');
    }
    const updateArgs = updateCall[0];
    if (!updateArgs) {
      throw new Error('Expected DynamoDB update arguments to be provided');
    }

    expect(updateArgs.ExpressionAttributeNames['#milestones']).toBe('Milestones');
    expect(updateArgs.ExpressionAttributeValues[':milestones']).toEqual([
      {
        id: 'visit-oval-office',
        name: 'Visit the Oval Office',
        percentageContribution: 50,
        assetIds: [
          'c8b70471-0f2a-4a40-a3f6-75b3f87c38af',
        ],
      },
      {
        id: 'visit-situation-room',
        name: 'Visit the Situation Room',
        percentageContribution: 50,
      },
    ]);
    expect(updateArgs.ExpressionAttributeNames['#assetIds']).toBe('AssetIds');
    expect(updateArgs.ExpressionAttributeValues[':assetIds']).toEqual([
      '94f5d18a-d91a-4d8f-954f-2d31cf212f68',
    ]);
  });

  it('returns 500 when DynamoDB throws', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
    });
    dynamoMocks.updatePromise.mockRejectedValueOnce(dynamoError);

    const response = await catalogTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          entryId: 'draft-a-bill',
        },
        body: {
          name: 'Draft a Bill',
          subheading: 'Research and write legislation',
          instructions: 'Work together to draft your bill.',
        },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(
      (response.body as InternalFailureErrorResponseContent).message,
    ).toEqual('Failed to save catalog entry');
  });

  it('returns 400 when milestones are invalid', async () => {
    const response = await catalogTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          entryId: 'tour-the-whitehouse',
        },
        body: {
          name: 'Tour the Whitehouse',
          subheading: 'Explore iconic rooms and history',
          instructions: 'Complete each stop on your tour.',
          milestones: [
            {
              id: 'visit-oval-office',
              name: 'Visit the Oval Office',
              percentageContribution: 80,
            },
            {
              id: 'visit-situation-room',
              name: 'Visit the Situation Room',
              percentageContribution: 10,
            },
          ],
        } as any,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: 'The sum of percentages awarded across all milestones must equal 100',
    });
    expect(dynamoMocks.update).not.toHaveBeenCalled();
  });

  it('returns 400 when duplicate task assetIds are provided', async () => {
    const response = await catalogTask({
      ...buildRequestArgs(),
      input: {
        requestParameters: {
          entryId: 'tour-the-whitehouse',
        },
        body: {
          name: 'Tour the Whitehouse',
          subheading: 'Explore iconic rooms and history',
          instructions: 'Complete each stop on your tour.',
          assetIds: [
            '3e922c1a-4893-4ab4-a9df-4dd7f2606f2b',
            '3e922c1a-4893-4ab4-a9df-4dd7f2606f2b',
          ],
        } as any,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: 'Duplicate assetId 3e922c1a-4893-4ab4-a9df-4dd7f2606f2b',
    });
    expect(dynamoMocks.update).not.toHaveBeenCalled();
  });
});
