import { DynamoDB, S3 } from 'aws-sdk';
import {
  getSimulatedTaskHandler,
  GetSimulatedTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import type {
  AssetContentType,
  Milestone,
  TaskViewAsset,
} from 'gallaudet-api-typescript-runtime';

import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';
import { getExperienceWithResolvedName } from './utils/experience-metadata-utils';

const ddbClient = new DynamoDB.DocumentClient();
const s3Client = new S3({ signatureVersion: 'v4' });
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');
const ASSETS_TABLE_NAME = getRequiredEnv('ASSETS_TABLE_NAME');
const ASSETS_BUCKET_NAME = getRequiredEnv('ASSETS_BUCKET_NAME');

const DEFAULT_ASSET_VIEW_URL_TTL_SECONDS = 900;
const SUPPORTED_ASSET_CONTENT_TYPES = new Set<AssetContentType>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

type CatalogEntryItem = {
  ExperienceId?: string;
  EntryId?: string;
  Name?: string;
  Subheading?: string;
  Instructions?: string;
  AssetIds?: string[];
  Milestones?: Milestone[];
};

type AssetItem = {
  AssetId?: string;
  ExperienceId?: string;
  FileName?: string;
  ContentType?: string;
  ObjectKey?: string;
  Status?: string;
};

const getOptionalPositiveIntEnv = (key: string, fallback: number): number => {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const normalizeAssetIds = (assetIds: string[] | undefined): string[] => {
  if (!assetIds) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const assetId of assetIds) {
    const trimmed = assetId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
};

/**
 * Type-safe handler for the GetSimulatedTask operation
 */
export const getSimulatedTask: GetSimulatedTaskChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetSimulatedTask Operation');

  const experienceId = request.input.requestParameters.experienceId;
  const entryId = request.input.requestParameters.entryId;

  logger.info(
    `Loading simulated task for experienceId=${experienceId}, entryId=${entryId}`,
  );

  let catalogEntry: CatalogEntryItem | undefined;
  try {
    const catalogResult = await ddbClient.get({
      TableName: TASK_CATALOG_TABLE_NAME,
      Key: {
        ExperienceId: experienceId,
        EntryId: entryId,
      },
    }).promise();
    catalogEntry = catalogResult.Item as CatalogEntryItem | undefined;
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to load catalog entry ${experienceId}/${entryId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to load simulated task',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error loading catalog entry ${experienceId}/${entryId}: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to load simulated task',
    });
  }

  if (!catalogEntry) {
    logger.warn(
      `Catalog entry not found for experienceId=${experienceId}, entryId=${entryId}`,
    );
    return Response.notFound({
      message: 'Task catalog entry not found',
    });
  }

  const title = catalogEntry.Name?.trim();
  const subheading = catalogEntry.Subheading?.trim();
  const instructions = catalogEntry.Instructions?.trim();
  const assetIds = catalogEntry.AssetIds;
  const milestones = catalogEntry.Milestones;

  if (!title || !subheading || !instructions) {
    logger.error(
      `Catalog entry ${experienceId}/${entryId} missing required fields. title=${!!title}, subheading=${!!subheading}, instructions=${!!instructions}`,
    );
    return Response.internalFailure({
      message: 'Task content incomplete',
    });
  }

  let experienceName: string;
  let robloxGameId: string;
  let experienceAssetIds: string[] | undefined;
  try {
    const resolvedExperience = await getExperienceWithResolvedName(experienceId, logger);
    experienceName = resolvedExperience.experienceName;
    const resolvedRobloxGameId = resolvedExperience.robloxGameId?.trim();
    if (!resolvedRobloxGameId) {
      logger.error(
        `Resolved experience metadata missing RobloxGameId for experienceId=${experienceId}, entryId=${entryId}`,
      );
      return Response.internalFailure({
        message: 'Task content incomplete',
      });
    }
    robloxGameId = resolvedRobloxGameId;
    experienceAssetIds = resolvedExperience.assetIds;
  } catch (error) {
    logger.error(
      `Failed to resolve experience metadata for experienceId=${experienceId}, entryId=${entryId}: ${(error as Error).message}`,
    );
    return Response.internalFailure({
      message: 'Failed to load simulated task',
    });
  }

  const assetViewUrlTtlSeconds = getOptionalPositiveIntEnv(
    'ASSET_VIEW_URL_TTL_SECONDS',
    DEFAULT_ASSET_VIEW_URL_TTL_SECONDS,
  );
  const normalizedTaskAssetIds = normalizeAssetIds(assetIds);
  const normalizedMilestoneAssetIds = (milestones ?? []).flatMap((milestone) =>
    normalizeAssetIds(milestone.assetIds),
  );
  const normalizedReferencedAssetIds = normalizeAssetIds([
    ...normalizedTaskAssetIds,
    ...normalizedMilestoneAssetIds,
  ]);

  const assets: TaskViewAsset[] = [];
  for (const assetId of normalizedReferencedAssetIds) {
    let assetRecord: AssetItem | undefined;
    try {
      const assetResult = await ddbClient.get({
        TableName: ASSETS_TABLE_NAME,
        Key: {
          AssetId: assetId,
        },
      }).promise();
      assetRecord = assetResult.Item as AssetItem | undefined;
    } catch (error) {
      if (isAWSError(error)) {
        logger.error(
          `Failed loading asset ${assetId} for simulated task ${experienceId}/${entryId}: ${error.code} - ${error.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task assets',
          details: `DynamoDB error: ${error.code}`,
        });
      }

      logger.error(
        `Unexpected error loading asset ${assetId} for simulated task ${experienceId}/${entryId}: ${JSON.stringify(error)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task assets',
      });
    }

    if (!assetRecord) {
      logger.warn(
        `Skipping missing asset ${assetId} for simulated task ${experienceId}/${entryId}`,
      );
      continue;
    }

    if (assetRecord.ExperienceId !== experienceId) {
      logger.warn(
        `Skipping cross-experience asset ${assetId} for simulated task ${experienceId}/${entryId}`,
      );
      continue;
    }

    if (assetRecord.Status !== 'ready') {
      logger.warn(
        `Skipping non-ready asset ${assetId} (status=${assetRecord.Status}) for simulated task ${experienceId}/${entryId}`,
      );
      continue;
    }

    if (
      !assetRecord.FileName ||
      !assetRecord.ObjectKey ||
      !assetRecord.ContentType ||
      !SUPPORTED_ASSET_CONTENT_TYPES.has(assetRecord.ContentType as AssetContentType)
    ) {
      logger.warn(
        `Skipping invalid asset metadata for assetId=${assetId} in simulated task ${experienceId}/${entryId}`,
      );
      continue;
    }

    let url: string;
    try {
      url = await s3Client.getSignedUrlPromise('getObject', {
        Bucket: ASSETS_BUCKET_NAME,
        Key: assetRecord.ObjectKey,
        Expires: assetViewUrlTtlSeconds,
      });
    } catch (error) {
      if (isAWSError(error)) {
        logger.error(
          `Failed creating view URL for assetId=${assetId}: ${error.code} - ${error.message}`,
        );
      } else {
        logger.error(
          `Unexpected error creating view URL for assetId=${assetId}: ${JSON.stringify(error)}`,
        );
      }
      return Response.internalFailure({
        message: 'Failed to prepare task assets',
      });
    }

    assets.push({
      assetId,
      fileName: assetRecord.FileName,
      contentType: assetRecord.ContentType as AssetContentType,
      url,
    });
  }

  return Response.success({
    task: {
      title,
      subheading,
      instructions,
      experienceName,
      robloxGameId,
      ...(assetIds !== undefined ? { assetIds } : {}),
      ...(assets.length > 0 ? { assets } : {}),
      ...(experienceAssetIds !== undefined ? { experienceAssetIds } : {}),
      ...(milestones !== undefined ? { milestones } : {}),
    },
  });
};

/**
 * Entry point for the AWS Lambda handler for the GetSimulatedTask operation.
 * The getSimulatedTaskHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getSimulatedTaskHandler(...INTERCEPTORS, getSimulatedTask);
