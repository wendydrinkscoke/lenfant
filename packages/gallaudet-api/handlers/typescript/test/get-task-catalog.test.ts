process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.PARTNERS_TABLE_NAME = 'Partners';

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
      Partners: [],
    },
  });
});

describe('GetTaskCatalog', () => {
  it('returns catalog grouped by partner', async () => {
    dynamoMocks.scanPromise.mockResolvedValueOnce({
      Items: [
        {
          ExperienceId: 'abcdefg',
          EntryId: 'draft-bill',
          Name: 'Draft a Bill',
          Subheading: 'Research and write legislation',
          Instructions: 'Work together to draft your bill.',
        },
        {
          ExperienceId: 'abcdefg',
          EntryId: 'tour-whitehouse',
          Name: 'Tour the White House',
          Subheading: 'Guided tour of the White House',
          Instructions: 'Visit each room in the tour.',
          Milestones: [
            {
              id: 'visit-oval-office',
              name: 'Visit the Oval Office',
              percentageContribution: 50,
            },
            {
              id: 'visit-situation-room',
              name: 'Visit the Situation Room',
              percentageContribution: 50,
            },
          ],
        },
        {
          ExperienceId: 'qredasg',
          EntryId: 'press-briefing',
          Name: 'Attend Press Briefing',
          Subheading: 'Answer questions from the press',
          Instructions: 'Hold a press briefing for reporters.',
        },
      ],
    });
    dynamoMocks.batchGetPromise.mockResolvedValueOnce({
      Responses: {
        Partners: [
          {
            ExperienceId: 'abcdefg',
            PartnerName: 'Partner Alpha',
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
        Partners: {
          Keys: [
            {
              ExperienceId: 'abcdefg',
            },
            {
              ExperienceId: 'qredasg',
            },
          ],
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      partners: [
        {
          partnerId: 'abcdefg',
          partnerName: 'Partner Alpha',
          catalogEntries: [
            {
              entryId: 'draft-bill',
              name: 'Draft a Bill',
              subheading: 'Research and write legislation',
              instructions: 'Work together to draft your bill.',
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
          partnerId: 'qredasg',
          partnerName: 'qredasg',
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
});
