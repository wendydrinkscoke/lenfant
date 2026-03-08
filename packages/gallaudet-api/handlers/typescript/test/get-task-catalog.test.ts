process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.EXPERIENCES_TABLE_NAME = 'Experiences';

import {
  GetTaskCatalogChainedRequestInput,
  InternalFailureErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getTaskCatalog } from '../src/get-task-catalog';

var dynamoMocks: {
  scan: jest.Mock;
  scanPromise: jest.Mock;
  batchGet: jest.Mock;
  batchGetPromise: jest.Mock;
};

jest.mock('aws-sdk', () => {
  dynamoMocks = {
    scanPromise: jest.fn(),
    batchGetPromise: jest.fn(),
    scan: jest.fn(() => ({
      promise: dynamoMocks.scanPromise,
    })),
    batchGet: jest.fn(() => ({
      promise: dynamoMocks.batchGetPromise,
    })),
  };

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        scan: dynamoMocks.scan,
        batchGet: dynamoMocks.batchGet,
      })),
    },
  };
});

const baseArgs = {
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
} satisfies Omit<GetTaskCatalogChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  dynamoMocks.scanPromise.mockResolvedValue({
    Items: [],
  });
  dynamoMocks.batchGetPromise.mockResolvedValue({
    Responses: {
      Experiences: [],
    },
  });
});

describe('GetTaskCatalog', () => {
  it('returns catalog grouped by experience', async () => {
    dynamoMocks.scanPromise.mockResolvedValueOnce({
      Items: [
        {
          ExperienceId: '9228429469',
          EntryId: 'draft-bill',
          Name: 'Draft a Bill',
          Subheading: 'Research and write legislation',
          Instructions: 'Work together to draft your bill.',
          AssetIds: [
            'ab5630e4-f64d-4f49-8c3e-45f87ab768e9',
          ],
        },
        {
          ExperienceId: '9228429469',
          EntryId: 'tour-whitehouse',
          Name: 'Tour the White House',
          Subheading: 'Guided tour of the White House',
          Instructions: 'Visit each room in the tour.',
          Milestones: [
            {
              id: 'visit-oval-office',
              name: 'Visit the Oval Office',
              percentageContribution: 50,
              assetIds: [
                'f2c69ed9-1ded-4ab4-a1f0-97de6d84ca5a',
              ],
            },
            {
              id: 'visit-situation-room',
              name: 'Visit the Situation Room',
              percentageContribution: 50,
            },
          ],
        },
        {
          ExperienceId: '9348701256',
          EntryId: 'press-briefing',
          Name: 'Attend Press Briefing',
          Subheading: 'Answer questions from the press',
          Instructions: 'Hold a press briefing for reporters.',
        },
      ],
    });
    dynamoMocks.batchGetPromise.mockResolvedValueOnce({
      Responses: {
        Experiences: [
          {
            ExperienceId: '9228429469',
            ExperienceName: 'Civics Quest: Capitol Edition',
            ExperienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
            AssetIds: [
              'c580fb04-787e-4c92-8dd9-d6ff22f4eb3b',
            ],
          },
          {
            ExperienceId: '9348701256',
            ExperienceName: 'Constitution Clash',
            ExperienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    const response = await getTaskCatalog({
      ...baseArgs,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(dynamoMocks.scan).toHaveBeenCalledWith({
      TableName: 'TaskCatalog',
    });
    expect(dynamoMocks.batchGet).toHaveBeenCalledWith({
      RequestItems: {
        Experiences: {
          Keys: [
            {
              ExperienceId: '9228429469',
            },
            {
              ExperienceId: '9348701256',
            },
          ],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      experiences: [
        {
          experienceId: '9228429469',
          experienceName: 'Civics Quest: Capitol Edition',
          assetIds: [
            'c580fb04-787e-4c92-8dd9-d6ff22f4eb3b',
          ],
          catalogEntries: [
            {
              entryId: 'draft-bill',
              name: 'Draft a Bill',
              subheading: 'Research and write legislation',
              instructions: 'Work together to draft your bill.',
              assetIds: [
                'ab5630e4-f64d-4f49-8c3e-45f87ab768e9',
              ],
            },
            {
              entryId: 'tour-whitehouse',
              name: 'Tour the White House',
              subheading: 'Guided tour of the White House',
              instructions: 'Visit each room in the tour.',
              milestones: [
                {
                  id: 'visit-oval-office',
                  name: 'Visit the Oval Office',
                  percentageContribution: 50,
                  assetIds: [
                    'f2c69ed9-1ded-4ab4-a1f0-97de6d84ca5a',
                  ],
                },
                {
                  id: 'visit-situation-room',
                  name: 'Visit the Situation Room',
                  percentageContribution: 50,
                },
              ],
            },
          ],
        },
        {
          experienceId: '9348701256',
          experienceName: 'Constitution Clash',
          catalogEntries: [
            {
              entryId: 'press-briefing',
              name: 'Attend Press Briefing',
              subheading: 'Answer questions from the press',
              instructions: 'Hold a press briefing for reporters.',
            },
          ],
        },
      ],
    });
  });

  it('returns 500 when DynamoDB scan fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
      message: 'Throughput exceeded',
    });
    dynamoMocks.scanPromise.mockRejectedValueOnce(dynamoError);

    const response = await getTaskCatalog({
      ...baseArgs,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to load task catalog',
    );
  });

  it('returns 500 when an experience entry is missing', async () => {
    dynamoMocks.scanPromise.mockResolvedValueOnce({
      Items: [
        {
          ExperienceId: '9917002468',
          EntryId: 'get-100-points',
          Name: 'Get 100 Points',
          Subheading: 'Obtain at least 100 points in one session',
          Instructions: 'Get points by selecting the correct country as quickly as possible.',
        },
      ],
    });
    dynamoMocks.batchGetPromise.mockResolvedValueOnce({
      Responses: {
        Experiences: [],
      },
    });

    const response = await getTaskCatalog({
      ...baseArgs,
      input: {
        requestParameters: {},
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual(
      'Failed to load task catalog',
    );
  });
});
