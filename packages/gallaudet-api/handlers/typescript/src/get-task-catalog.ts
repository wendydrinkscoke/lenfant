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
import {
  getExperiencesWithResolvedNames,
  type ResolvedExperienceMetadata,
} from './utils/experience-metadata-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');

type CatalogItem = {
  ExperienceId?: string;
  EntryId?: string;
  CreatedAt: string;
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
    assetIds?: string[];
    catalogEntries: CatalogEntry[];
  }>();

  const experienceIds = Array.from(new Set(
    items.map((item) => item.ExperienceId).filter((experienceId): experienceId is string => !!experienceId),
  ));

  let experiencesById = new Map<string, ResolvedExperienceMetadata>();
  if (experienceIds.length > 0) {
    try {
      experiencesById = await getExperiencesWithResolvedNames(experienceIds, logger);
      logger.info(`Fetched ${experiencesById.size} experiences`);
    } catch (error) {
      logger.error(`Failed to resolve experiences: ${(error as Error).message}`);
      // TODO(metrics): emit a metric when task catalog fails on experience metadata resolution.
      return Response.internalFailure({
        message: 'Failed to load task catalog',
      });
    }
  }

  for (const item of items) {
    const experienceId = item.ExperienceId;
    const entryId = item.EntryId;
    const name = item.Name;
    const subheading = item.Subheading;
    const instructions = item.Instructions;
    const assetIds = item.AssetIds;
    const milestones = item.Milestones;
    if (
      !experienceId ||
      !entryId ||
      !name ||
      !subheading ||
      !instructions
    ) {
      logger.warn(`Skipping malformed catalog entry: ${JSON.stringify(item)}`);
      continue;
    }

    if (!experiencesMap.has(experienceId)) {
      const resolvedExperience = experiencesById.get(experienceId);
      if (!resolvedExperience) {
        logger.error(`Resolved experience metadata missing for experienceId=${experienceId}`);
        // TODO(metrics): emit a metric when expected experience metadata is missing in task catalog assembly.
        return Response.internalFailure({
          message: 'Failed to load task catalog',
        });
      }

      const experienceName = resolvedExperience.experienceName;
      const experienceAssetIds = resolvedExperience.assetIds;
      experiencesMap.set(experienceId, {
        experienceId,
        experienceName,
        ...(experienceAssetIds !== undefined ? { assetIds: experienceAssetIds } : {}),
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
    if (assetIds) {
      entry.assetIds = assetIds;
    }
    experiencesMap.get(experienceId)?.catalogEntries.push(entry);
  }

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
