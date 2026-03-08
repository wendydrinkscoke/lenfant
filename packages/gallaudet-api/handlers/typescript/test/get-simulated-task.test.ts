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
const EXPERIENCE_ID = '9228429469';
const ENTRY_ID = 'get-100-points';
const EXPERIENCE_ASSET_ID = '07e3087d-7130-4c66-bf25-95b38295f0a7';
const TASK_ASSET_ID = '25242edd-4e8b-4b84-9588-3d472d927b9a';
const MILESTONE_ASSET_ID = 'bcc9faf9-b6ce-4b1a-989f-95ce1f148f6a';
const CROSS_EXPERIENCE_ASSET_ID = 'f3c0a8bc-75d2-48c4-aadb-676f5e8c3f9a';
const TASK_ASSET_OBJECT_KEY = `3448c4d8-70e1-703a-6450-fbf81e4d71b4/${EXPERIENCE_ID}/${TASK_ASSET_ID}/task-preview.gif`;
const MILESTONE_ASSET_OBJECT_KEY = `3448c4d8-70e1-703a-6450-fbf81e4d71b4/${EXPERIENCE_ID}/${MILESTONE_ASSET_ID}/milestone-preview.png`;
const TASK_ASSET_URL =
  `https://assets-bucket.s3.amazonaws.com/${TASK_ASSET_OBJECT_KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TEST%2F20260308%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260308T101435Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=11aa22bb33cc44dd`;
const MILESTONE_ASSET_URL =
  `https://assets-bucket.s3.amazonaws.com/${MILESTONE_ASSET_OBJECT_KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=TEST%2F20260308%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260308T101437Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=55ee66ff77aa88bb`;

const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: '3448c4d8-70e1-703a-6450-fbf81e4d71b4',
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
    experienceId: EXPERIENCE_ID,
    experienceName: 'Civics City',
    experienceNameFetchedAt: '2999-01-01T00:00:00.000Z',
    robloxGameId: '127120714583972',
    assetIds: [EXPERIENCE_ASSET_ID],
  });
  s3GetSignedUrlPromiseMock.mockImplementation(
    async (_operation: string, params: { Key: string }) => {
      if (params.Key.endsWith('/task-preview.gif')) {
        return TASK_ASSET_URL;
      }
      if (params.Key.endsWith('/milestone-preview.png')) {
        return MILESTONE_ASSET_URL;
      }
      return 'https://assets-bucket.s3.amazonaws.com/generic.png?X-Amz-Algorithm=AWS4-HMAC-SHA256';
    },
  );
  dynamoGetMock.mockImplementation((params: { TableName: string; Key?: Record<string, string> }) => {
    if (params.TableName === 'TaskCatalog') {
      return {
        promise: jest.fn().mockResolvedValue({
          Item: {
            ExperienceId: EXPERIENCE_ID,
            EntryId: ENTRY_ID,
            Name: 'Tour the White House',
            Subheading: 'Guided walkthrough of key rooms',
            Instructions: 'Visit each checkpoint and report what you observed.',
            AssetIds: [TASK_ASSET_ID],
            Milestones: [
              {
                id: 'visit-oval-office',
                name: 'Visit the Oval Office',
                percentageContribution: 50,
                assetIds: [MILESTONE_ASSET_ID, CROSS_EXPERIENCE_ASSET_ID],
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
      if (assetId === TASK_ASSET_ID) {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: TASK_ASSET_ID,
              ExperienceId: EXPERIENCE_ID,
              FileName: 'task-preview.gif',
              ContentType: 'image/gif',
              ObjectKey: TASK_ASSET_OBJECT_KEY,
              Status: 'ready',
            },
          }),
        };
      }
      if (assetId === MILESTONE_ASSET_ID) {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: MILESTONE_ASSET_ID,
              ExperienceId: EXPERIENCE_ID,
              FileName: 'milestone-preview.png',
              ContentType: 'image/png',
              ObjectKey: MILESTONE_ASSET_OBJECT_KEY,
              Status: 'ready',
            },
          }),
        };
      }
      if (assetId === CROSS_EXPERIENCE_ASSET_ID) {
        return {
          promise: jest.fn().mockResolvedValue({
            Item: {
              AssetId: CROSS_EXPERIENCE_ASSET_ID,
              ExperienceId: '9348701256',
              FileName: 'cross-asset.png',
              ContentType: 'image/png',
              ObjectKey: `3448c4d8-70e1-703a-6450-fbf81e4d71b4/9348701256/${CROSS_EXPERIENCE_ASSET_ID}/cross-asset.png`,
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
          experienceId: EXPERIENCE_ID,
          entryId: ENTRY_ID,
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
        robloxGameId: '127120714583972',
        experienceAssetIds: [EXPERIENCE_ASSET_ID],
        assetIds: [TASK_ASSET_ID],
        milestones: [
          {
            id: 'visit-oval-office',
            name: 'Visit the Oval Office',
            percentageContribution: 50,
            assetIds: [MILESTONE_ASSET_ID, CROSS_EXPERIENCE_ASSET_ID],
          },
          {
            id: 'complete-briefing',
            name: 'Complete the briefing',
            percentageContribution: 50,
          },
        ],
        assets: [
          {
            assetId: TASK_ASSET_ID,
            fileName: 'task-preview.gif',
            contentType: 'image/gif',
            url: TASK_ASSET_URL,
          },
          {
            assetId: MILESTONE_ASSET_ID,
            fileName: 'milestone-preview.png',
            contentType: 'image/png',
            url: MILESTONE_ASSET_URL,
          },
        ],
      },
    });
    expect(mockedGetExperienceWithResolvedName).toHaveBeenCalledWith(
      EXPERIENCE_ID,
      requestArguments.interceptorContext.logger,
    );
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: TASK_ASSET_OBJECT_KEY,
      Expires: 900,
    });
    expect(s3GetSignedUrlPromiseMock).toHaveBeenCalledWith('getObject', {
      Bucket: 'AssetsBucket',
      Key: MILESTONE_ASSET_OBJECT_KEY,
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
          experienceId: EXPERIENCE_ID,
          entryId: ENTRY_ID,
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
          experienceId: EXPERIENCE_ID,
          entryId: ENTRY_ID,
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
      new Error(`Experience entry missing for experienceId=${EXPERIENCE_ID}`),
    );

    const response = await getSimulatedTask({
      ...requestArguments,
      input: {
        requestParameters: {
          experienceId: EXPERIENCE_ID,
          entryId: ENTRY_ID,
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
              ExperienceId: EXPERIENCE_ID,
              EntryId: ENTRY_ID,
              Name: 'Tour the White House',
              Subheading: 'Guided walkthrough of key rooms',
              Instructions: 'Visit each checkpoint and report what you observed.',
              AssetIds: [TASK_ASSET_ID],
            },
          }),
        };
      }

      if (params.TableName === 'Assets' && params.Key?.AssetId === TASK_ASSET_ID) {
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
          experienceId: EXPERIENCE_ID,
          entryId: ENTRY_ID,
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
