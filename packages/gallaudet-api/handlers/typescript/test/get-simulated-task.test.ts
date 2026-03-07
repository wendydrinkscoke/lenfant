process.env.TASK_CATALOG_TABLE_NAME = 'TaskCatalog';
process.env.EXPERIENCES_TABLE_NAME = 'Experiences';
process.env.ASSETS_TABLE_NAME = 'Assets';
process.env.ASSETS_BUCKET_NAME = 'AssetsBucket';

import {
  GetSimulatedTaskChainedRequestInput,
  InternalFailureErrorResponseContent,
  NotFoundErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getSimulatedTask } from '../src/get-simulated-task';
import { getExperienceWithResolvedName } from '../src/utils/experience-metadata-utils';

jest.mock('../src/utils/experience-metadata-utils', () => ({
  getExperienceWithResolvedName: jest.fn(),
}));

var dynamoGetMock: jest.Mock;
var s3GetSignedUrlPromiseMock: jest.Mock;

jest.mock('aws-sdk', () => {
  dynamoGetMock = jest.fn();
  s3GetSignedUrlPromiseMock = jest.fn();

  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get: dynamoGetMock,
      })),
    },
    S3: jest.fn(() => ({
      getSignedUrlPromise: s3GetSignedUrlPromiseMock,
    })),
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
} satisfies Omit<GetSimulatedTaskChainedRequestInput, 'input'>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetExperienceWithResolvedName.mockResolvedValue({
    experienceId: 'exp-123',
    experienceName: 'Civics City',
    experienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
    robloxGameId: '1213026131',
    assetIds: ['experience-asset-1'],
  });
  s3GetSignedUrlPromiseMock.mockImplementation(
    async (_operation: string, params: { Key: string }) => {
      if (params.Key.endsWith('/task-preview.gif')) {
        return 'https://assets-bucket.s3.amazonaws.com/presigned-task-asset';
      }
      if (params.Key.endsWith('/milestone-preview.png')) {
        return 'https://assets-bucket.s3.amazonaws.com/presigned-milestone-asset';
      }
      return 'https://assets-bucket.s3.amazonaws.com/presigned-generic-asset';
    },
  );
  dynamoGetMock.mockImplementation((params: { TableName: string; Key?: Record<string, string> }) => {
    if (params.TableName === 'TaskCatalog') {
      return {
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: 'exp-123',
            EntryId: 'task-001',
            Name: 'Tour the White House',
            Subheading: 'Guided walkthrough of key rooms',
            Instructions: 'Visit each checkpoint and report what you observed.',
            AssetIds: ['task-asset-1'],
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
                assetIds: ['milestone-asset-1', 'cross-experience-asset'],
              },
              {
                id: 'complete-briefing',
                name: 'Complete the briefing',
                percentageContribution: 50,
              },
            ],
          },
        }),
      };
    }

    if (params.TableName === 'Assets') {
      const assetId = params.Key?.AssetId;
      if (assetId === 'task-asset-1') {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: 'task-asset-1',
              ExperienceId: 'exp-123',
              FileName: 'task-preview.gif',
              ContentType: 'image/gif',
              ObjectKey: 'mock-cognito/exp-123/task-asset-1/task-preview.gif',
              Status: 'ready',
            },
          }),
        };
      }
      if (assetId === 'milestone-asset-1') {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: 'milestone-asset-1',
              ExperienceId: 'exp-123',
              FileName: 'milestone-preview.png',
              ContentType: 'image/png',
              ObjectKey: 'mock-cognito/exp-123/milestone-asset-1/milestone-preview.png',
              Status: 'ready',
            },
          }),
        };
      }
      if (assetId === 'cross-experience-asset') {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: 'cross-experience-asset',
              ExperienceId: 'exp-999',
              FileName: 'cross-asset.png',
              ContentType: 'image/png',
              ObjectKey: 'mock-cognito/exp-999/cross/cross-asset.png',
              Status: 'ready',
            },
          }),
        };
      }

      return {
        promise: jest.fn().mockResolvedValue({}),
      };
    }

    return {
      promise: jest.fn().mockResolvedValue({}),
    };
  });
});

describe('GetSimulatedTask', () => {
  it('returns a simulated task view with presigned asset URLs', async () => {
    const response = await getSimulatedTask({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: 'exp-123',
          entryId: 'task-001',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      task: {
        title: 'Tour the White House',
        subheading: 'Guided walkthrough of key rooms',
        instructions: 'Visit each checkpoint and report what you observed.',
        experienceName: 'Civics City',
        robloxGameId: '1213026131',
        experienceAssetIds: ['experience-asset-1'],
        assetIds: ['task-asset-1'],
        milestones: [
          {
            id: 'visit-oval-office',
            name: 'Visit the Oval Office',
            percentageContribution: 50,
            assetIds: ['milestone-asset-1', 'cross-experience-asset'],
          },
          {
            id: 'complete-briefing',
            name: 'Complete the briefing',
            percentageContribution: 50,
          },
        ],
        assets: [
          {
            assetId: 'task-asset-1',
            fileName: 'task-preview.gif',
            contentType: 'image/gif',
            url: 'https://assets-bucket.s3.amazonaws.com/presigned-task-asset',
          },
          {
            assetId: 'milestone-asset-1',
            fileName: 'milestone-preview.png',
            contentType: 'image/png',
            url: 'https://assets-bucket.s3.amazonaws.com/presigned-milestone-asset',
          },
        ],
      },
    });
    expect(mockedGetExperienceWithResolvedName).toHaveBeenCalledWith(
      'exp-123',
      requestArguments.interceptorContext.logger,
    );
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: 'mock-cognito/exp-123/task-asset-1/task-preview.gif',
      Expires: 900,
    });
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: 'mock-cognito/exp-123/milestone-asset-1/milestone-preview.png',
      Expires: 900,
    });
  });

  it('returns 404 when the catalog entry is missing', async () => {
    dynamoGetMock.mockImplementation((params: { TableName: string }) => {
      if (params.TableName === 'TaskCatalog') {
        return {
          promise: jest.fn().mockResolvedValue({}),
        };
      }

      return {
        promise: jest.fn().mockResolvedValue({}),
      };
    });

    const response = await getSimulatedTask({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: 'exp-123',
          entryId: 'task-001',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(404);
    expect((response.body as NotFoundErrorResponseContent).message).toBe(
      'Task catalog entry not found',
    );
  });

  it('returns 500 when loading the catalog entry fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ResourceNotFoundException',
      message: 'TaskCatalog missing',
    });

    dynamoGetMock.mockImplementation((params: { TableName: string }) => {
      if (params.TableName === 'TaskCatalog') {
        return {
          promise: jest.fn().mockRejectedValue(dynamoError),
        };
      }

      return {
        promise: jest.fn().mockResolvedValue({}),
      };
    });

    const response = await getSimulatedTask({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: 'exp-123',
          entryId: 'task-001',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toBe(
      'Failed to load simulated task',
    );
  });

  it('returns 500 when experience metadata cannot be resolved', async () => {
    mockedGetExperienceWithResolvedName.mockRejectedValueOnce(
      new Error('Experience entry missing for experienceId=exp-123'),
    );

    const response = await getSimulatedTask({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: 'exp-123',
          entryId: 'task-001',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toBe(
      'Failed to load simulated task',
    );
  });

  it('returns 500 when an asset lookup fails', async () => {
    const dynamoError = Object.assign(new Error('boom'), {
      code: 'ProvisionedThroughputExceededException',
      message: 'Request limit exceeded',
    });

    dynamoGetMock.mockImplementation((params: { TableName: string; Key?: Record<string, string> }) => {
      if (params.TableName === 'TaskCatalog') {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              ExperienceId: 'exp-123',
              EntryId: 'task-001',
              Name: 'Tour the White House',
              Subheading: 'Guided walkthrough of key rooms',
              Instructions: 'Visit each checkpoint and report what you observed.',
              AssetIds: ['task-asset-1'],
            },
          }),
        };
      }

      if (params.TableName === 'Assets' && params.Key?.AssetId === 'task-asset-1') {
        return {
          promise: jest.fn().mockRejectedValue(dynamoError),
        };
      }

      return {
        promise: jest.fn().mockResolvedValue({}),
      };
    });

    const response = await getSimulatedTask({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: 'exp-123',
          entryId: 'task-001',
        },
        body: undefined as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toBe(
      'Failed to load task assets',
    );
  });
});
