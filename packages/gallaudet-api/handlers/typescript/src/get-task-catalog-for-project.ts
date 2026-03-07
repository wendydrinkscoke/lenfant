import { DynamoDB } from 'aws-sdk';
import {
  getTaskCatalogForProjectHandler,
  GetTaskCatalogForProjectChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import type { Milestone } from 'gallaudet-api-typescript-runtime';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';
import { getExperienceWithResolvedName } from './utils/experience-metadata-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');

type CatalogItem = {
  ExperienceId?: string;
  EntryId?: string;
  Name?: string;
  Subheading?: string;
  Instructions?: string;
  AssetIds?: string[];
  Milestones?: Milestone[];
};

type CatalogEntry = {
  entryId: string;
  name: string;
  subheading: string;
  instructions: string;
  assetIds?: string[];
  milestones?: Milestone[];
};

type ResolvedExperience = {
  experienceName: string;
  assetIds?: string[];
};

/**
 * Type-safe handler for the GetTaskCatalogForProject operation
 */
export const getTaskCatalogForProject: GetTaskCatalogForProjectChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetTaskCatalogForProject Operation');

  const experienceId = request.input.requestParameters.experienceId;

  const catalogItems: CatalogItem[] = [];
  let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

  try {
    do {
      const queryResult = await ddbClient.query({
        TableName: TASK_CATALOG_TABLE_NAME,
        KeyConditionExpression: '#experienceId = :experienceId',
        ExpressionAttributeNames: {
          '#experienceId': 'ExperienceId',
        },
        ExpressionAttributeValues: {
          ':experienceId': experienceId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }).promise();

      catalogItems.push(...((queryResult.Items as CatalogItem[] | undefined) ?? []));
      lastEvaluatedKey = queryResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to query task catalog for experienceId=${experienceId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task catalog',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error querying task catalog for experienceId=${experienceId}: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to load task catalog',
    });
  }

  let resolvedExperience: ResolvedExperience;
  try {
    const resolvedMetadata = await getExperienceWithResolvedName(experienceId, logger);
    resolvedExperience = {
      experienceName: resolvedMetadata.experienceName,
      ...(resolvedMetadata.assetIds !== undefined ? { assetIds: resolvedMetadata.assetIds } : {}),
    };
  } catch (error) {
    logger.error(
      `Failed to resolve experience metadata for experienceId=${experienceId}: ${(error as Error).message}`,
    );
    return Response.internalFailure({
      message: 'Failed to load task catalog',
    });
  }

  const catalogEntries: CatalogEntry[] = [];
  for (const item of catalogItems) {
    const entryId = item.EntryId;
    const name = item.Name;
    const subheading = item.Subheading;
    const instructions = item.Instructions;
    const assetIds = item.AssetIds;
    const milestones = item.Milestones;

    if (!entryId || !name || !subheading || !instructions) {
      logger.warn(
        `Skipping malformed task catalog entry for experienceId=${experienceId}: ${JSON.stringify(item)}`,
      );
      continue;
    }

    catalogEntries.push({
      entryId,
      name,
      subheading,
      instructions,
      ...(assetIds !== undefined ? { assetIds } : {}),
      ...(milestones !== undefined ? { milestones } : {}),
    });
  }

  catalogEntries.sort((left, right) => left.name.localeCompare(right.name));

  return Response.success({
    experience: {
      experienceId,
      experienceName: resolvedExperience.experienceName,
      ...(resolvedExperience.assetIds !== undefined ? { assetIds: resolvedExperience.assetIds } : {}),
      catalogEntries,
    },
  });
};

/**
 * Entry point for the AWS Lambda handler for the GetTaskCatalogForProject operation.
 * The getTaskCatalogForProjectHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getTaskCatalogForProjectHandler(...INTERCEPTORS, getTaskCatalogForProject);
