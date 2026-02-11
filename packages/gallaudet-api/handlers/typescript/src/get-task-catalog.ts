import { DynamoDB } from 'aws-sdk';
import {
  getTaskCatalogHandler,
  GetTaskCatalogChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import type { Milestone } from 'gallaudet-api-typescript-runtime';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');
const EXPERIENCES_TABLE_NAME = getRequiredEnv('EXPERIENCES_TABLE_NAME');

type ExperienceItem = {
  ExperienceId?: string;
  CreatedAt?: string;
  ExperienceName?: string;
  RobloxGameId?: string;
  UpdatedAt?: string;
}

type CatalogItem = {
  ExperienceId?: string;
  EntryId?: string;
  CreatedAt: string;
  Name?: string;
  Subheading?: string;
  Instructions?: string;
  Milestones?: Milestone[];
};

type CatalogEntry = {
  entryId: string;
  name: string;
  subheading: string;
  instructions: string;
  milestones?: Milestone[];
};

/**
 * Type-safe handler for the GetTaskCatalog operation
 */
export const getTaskCatalog: GetTaskCatalogChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetTaskCatalog Operation');

  let items: CatalogItem[] = [];
  try {
    const result = await ddbClient.scan({
      TableName: TASK_CATALOG_TABLE_NAME,
    }).promise();
    items = (result.Items as CatalogItem[]) ?? [];
    logger.info(`Fetched ${items.length} task catalog entries`);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(`Failed to read task catalog: ${error.code} - ${error.message}`);
      return Response.internalFailure({
        message: 'Failed to load task catalog',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(`Unexpected error loading task catalog: ${JSON.stringify(error)}`);
    return Response.internalFailure({
      message: 'Failed to load task catalog',
    });
  }

  const experiencesMap = new Map<string, {
    experienceId: string;
    experienceName: string;
    catalogEntries: CatalogEntry[];
  }>();

  const experienceIds = Array.from(new Set(
    items.map((item) => item.ExperienceId).filter((experienceId): experienceId is string => !!experienceId),
  ));

  const experiencesById = new Map<string, ExperienceItem>();
  if (experienceIds.length > 0) {
    try {
      const experiencesResult = await ddbClient.batchGet({
        RequestItems: {
          [EXPERIENCES_TABLE_NAME]: {
            Keys: experienceIds.map((experienceId) => ({ ExperienceId: experienceId })),
          },
        },
      }).promise();
      const experiences = (experiencesResult.Responses?.[EXPERIENCES_TABLE_NAME] as ExperienceItem[]) ?? [];
      experiences.forEach((experience) => {
        if (experience.ExperienceId) {
          experiencesById.set(experience.ExperienceId, experience);
        }
      });
      const unprocessed = experiencesResult.UnprocessedKeys?.[EXPERIENCES_TABLE_NAME]?.Keys;
      if (unprocessed?.length) {
        logger.warn(`Unprocessed experience keys: ${JSON.stringify(unprocessed)}`);
      }
      logger.info(`Fetched ${experiencesById.size} experiences`);
    } catch (error) {
      if (isAWSError(error)) {
        logger.error(`Failed to read experiences: ${error.code} - ${error.message}`);
        return Response.internalFailure({
          message: 'Failed to load task catalog',
          details: `DynamoDB error: ${error.code}`,
        });
      }

      logger.error(`Unexpected error loading experiences: ${JSON.stringify(error)}`);
      return Response.internalFailure({
        message: 'Failed to load task catalog',
      });
    }
  }

  items.forEach((item) => {
    const experienceId = item.ExperienceId;
    const entryId = item.EntryId;
    const name = item.Name;
    const subheading = item.Subheading;
    const instructions = item.Instructions;
    const milestones = item.Milestones;
    if (
      !experienceId ||
      !entryId ||
      !name ||
      !subheading ||
      !instructions
    ) {
      logger.warn(`Skipping malformed catalog entry: ${JSON.stringify(item)}`);
      return;
    }

    if (!experiencesMap.has(experienceId)) {
      const experienceName = experiencesById.get(experienceId)?.ExperienceName ?? experienceId;
      experiencesMap.set(experienceId, {
        experienceId,
        experienceName,
        catalogEntries: [],
      });
    }

    const entry: CatalogEntry = {
      entryId,
      name,
      subheading,
      instructions,
    };
    if (milestones) {
      entry.milestones = milestones;
    }
    experiencesMap.get(experienceId)?.catalogEntries.push(entry);
  });

  const experiences = Array.from(experiencesMap.values()).map((experience) => ({
    ...experience,
    catalogEntries: experience.catalogEntries.sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => a.experienceName.localeCompare(b.experienceName));

  logger.info(`Returning catalog for ${experiences.length} experiences`);

  return Response.success({
    experiences,
  });
};

/**
 * Entry point for the AWS Lambda handler for the GetTaskCatalog operation.
 * The getTaskCatalogHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getTaskCatalogHandler(...INTERCEPTORS, getTaskCatalog);
