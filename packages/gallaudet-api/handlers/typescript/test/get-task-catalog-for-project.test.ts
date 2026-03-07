process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.EXPERIENCES_TABLE_NAME = 'Experiences';

import {
  GetTaskCatalogForProjectChainedRequestInput,
  InternalFailureErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getTaskCatalogForProject } from '../src/get-task-catalog-for-project';
import { getExperienceWithResolvedName } from '../src/utils/experience-metadata-utils';

jest.mock('../src/utils/experience-metadata-utils', () => ({
  getExperienceWithResolvedName: jest.fn(),
}));

var dynamoMocks: {
  query: jest.Mock;
  queryPromise: jest.Mock;
};

jest.mock('aws-sdk', () => {
  dynamoMocks = {
    queryPromise: jest.fn(),
    query: jest.fn(() => ({
      promise: dynamoMocks.queryPromise,
    })),
  };

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query: dynamoMocks.query,
      })),
    },
  };
});

const mockedGetExperienceWithResolvedName = getExperienceWithResolvedName as jest.Mock;

const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: 'cognito-user-123',
        },
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
} satisfies Omit<GetTaskCatalogForProjectChainedRequestInput, 'input'>;

describe('GetTaskCatalogForProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetExperienceWithResolvedName.mockResolvedValue({
      experienceId: 'exp-123',
      experienceName: 'Civics City',
      experienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
      assetIds: ['2f41022d-b8b6-4997-bf94-23f6f47c4790'],
    });
    dynamoMocks.queryPromise.mockResolvedValue({
      Items: [],
    });
  });

  it('returns catalog entries for the requested project', async () => {
    dynamoMocks.queryPromise.mockResolvedValueOnce({
      Items: [
        {
          ExperienceId: 'exp-123',
          EntryId: 'tour-whitehouse',
          Name: 'Tour the White House',
          Subheading: 'Guided tour through iconic rooms',
          Instructions: 'Visit each room in sequence.',
          Milestones: [
            {
              id: 'visit-oval-office',
              name: 'Visit the Oval Office',
              percentageContribution: 50,
            },
          ],
        },
        {
          ExperienceId: 'exp-123',
          EntryId: 'draft-bill',
          Name: 'Draft a Bill',
          Subheading: 'Research and write legislation',
          Instructions: 'Collaborate with your peers to produce a bill.',
          AssetIds: ['d11e1567-d6d2-49ea-9bb0-8c30d70b35e4'],
        },
        {
          ExperienceId: 'exp-123',
          EntryId: 'malformed-entry',
          Name: 'Malformed',
          Subheading: 'Missing instructions',
        },
      ],
    });

    const response = await getTaskCatalogForProject({
      ...requestArguments,
      input: {
        requestParameters: { experienceId: 'exp-123' },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(dynamoMocks.query).toHaveBeenCalledWith({
      TableName: 'TaskCatalog',
      KeyConditionExpression: '#experienceId = :experienceId',
      ExpressionAttributeNames: {
        '#experienceId': 'ExperienceId',
      },
      ExpressionAttributeValues: {
        ':experienceId': 'exp-123',
      },
      ExclusiveStartKey: undefined,
    });
    expect(mockedGetExperienceWithResolvedName).toHaveBeenCalledWith(
      'exp-123',
      requestArguments.interceptorContext.logger,
    );
    expect(response.body).toEqual({
      experience: {
        experienceId: 'exp-123',
        experienceName: 'Civics City',
        assetIds: ['2f41022d-b8b6-4997-bf94-23f6f47c4790'],
        catalogEntries: [
          {
            entryId: 'draft-bill',
            name: 'Draft a Bill',
            subheading: 'Research and write legislation',
            instructions: 'Collaborate with your peers to produce a bill.',
            assetIds: ['d11e1567-d6d2-49ea-9bb0-8c30d70b35e4'],
          },
          {
            entryId: 'tour-whitehouse',
            name: 'Tour the White House',
            subheading: 'Guided tour through iconic rooms',
            instructions: 'Visit each room in sequence.',
            milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
              },
            ],
          },
        ],
      },
    });
  });

  it('returns an empty catalog list when no entries exist yet', async () => {
    dynamoMocks.queryPromise.mockResolvedValueOnce({
      Items: [],
    });

    const response = await getTaskCatalogForProject({
      ...requestArguments,
      input: {
        requestParameters: { experienceId: 'exp-123' },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      experience: {
        experienceId: 'exp-123',
        experienceName: 'Civics City',
        assetIds: ['2f41022d-b8b6-4997-bf94-23f6f47c4790'],
        catalogEntries: [],
      },
    });
  });

  it('returns 500 when task catalog query fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ResourceNotFoundException',
      message: 'TaskCatalog not found',
    });
    dynamoMocks.queryPromise.mockRejectedValueOnce(dynamoError);

    const response = await getTaskCatalogForProject({
      ...requestArguments,
      input: {
        requestParameters: { experienceId: 'exp-123' },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toBe(
      'Failed to load task catalog',
    );
  });

  it('returns 500 when experience metadata cannot be resolved', async () => {
    mockedGetExperienceWithResolvedName.mockRejectedValueOnce(
      new Error('Experience entry missing for experienceId=exp-123'),
    );

    const response = await getTaskCatalogForProject({
      ...requestArguments,
      input: {
        requestParameters: { experienceId: 'exp-123' },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toBe(
      'Failed to load task catalog',
    );
  });
});
