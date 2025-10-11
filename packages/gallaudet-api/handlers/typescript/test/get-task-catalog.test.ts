process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';

import {
  GetTaskCatalogChainedRequestInput,
  InternalFailureErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getTaskCatalog } from '../src/get-task-catalog';

var dynamoMocks: {
  scan: jest.Mock;
  scanPromise: jest.Mock;
};

jest.mock('aws-sdk', () => {
  dynamoMocks = {
    scanPromise: jest.fn(),
    scan: jest.fn(() => ({
      promise: dynamoMocks.scanPromise,
    })),
  };

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        scan: dynamoMocks.scan,
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
});

describe('GetTaskCatalog', () => {
  it('returns catalog grouped by partner', async () => {
    dynamoMocks.scanPromise.mockResolvedValueOnce({
      Items: [
        {
          PartnerId: 'partnerA',
          PartnerName: 'Partner Alpha',
          EntryId: 'draft-bill',
          Name: 'Draft a Bill',
          Subheading: 'Research and write legislation',
          Instructions: 'Work together to draft your bill.',
          GradingMethod: 'simple-completion',
        },
        {
          PartnerId: 'partnerA',
          PartnerName: 'Partner Alpha',
          EntryId: 'tour-whitehouse',
          Name: 'Tour the White House',
          Subheading: 'Guided tour of the White House',
          Instructions: 'Visit each room in the tour.',
          GradingMethod: 'simple-completion',
        },
        {
          PartnerId: 'partnerB',
          EntryId: 'press-briefing',
          Name: 'Attend Press Briefing',
          Subheading: 'Answer questions from the press',
          Instructions: 'Hold a press briefing for reporters.',
          GradingMethod: 'simple-completion',
        },
      ],
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
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      partners: [
        {
          partnerId: 'partnerA',
          partnerName: 'Partner Alpha',
          catalogEntries: [
            {
              entryId: 'draft-bill',
              name: 'Draft a Bill',
              subheading: 'Research and write legislation',
              instructions: 'Work together to draft your bill.',
              gradingMethod: 'simple-completion',
            },
            {
              entryId: 'tour-whitehouse',
              name: 'Tour the White House',
              subheading: 'Guided tour of the White House',
              instructions: 'Visit each room in the tour.',
              gradingMethod: 'simple-completion',
            },
          ],
        },
        {
          partnerId: 'partnerB',
          partnerName: 'partnerB',
          catalogEntries: [
            {
              entryId: 'press-briefing',
              name: 'Attend Press Briefing',
              subheading: 'Answer questions from the press',
              instructions: 'Hold a press briefing for reporters.',
              gradingMethod: 'simple-completion',
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
