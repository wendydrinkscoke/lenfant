import { classroom } from '@googleapis/classroom';
import { DynamoDB, S3 } from 'aws-sdk';
import {
  getTaskHandler,
  GetTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import type {
  Milestone,
  AssetContentType,
  TaskViewAsset,
} from 'gallaudet-api-typescript-runtime';

import { getCognitoUserIdFromEvent, getGoogleOAuthClient } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';
import { getExperienceWithResolvedName } from './utils/experience-metadata-utils';

const ddbClient = new DynamoDB.DocumentClient();
const s3Client = new S3({ signatureVersion: 'v4' });
const TASK_INSTANCE_TABLE_NAME = getRequiredEnv('TASK_INSTANCE_TABLE_NAME');
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

type TaskInstanceItem = {
  InstanceId?: string;
  CourseId?: string;
  ItemId?: string;
  ExperienceId?: string;
  EntryId?: string;
  CatalogEntryName?: string;
  AttachmentId?: string;
};

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
 * Type-safe handler for the GetTask operation
 */
export const getTask: GetTaskChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetTask Operation');

  try {
    const taskId = request.input.requestParameters?.taskId?.trim();
    if (!taskId) {
      logger.warn('Missing taskId path parameter');
      return Response.notFound({
        message: 'Task not found',
      });
    }
    logger.info(`Processing GetTask for taskId=${taskId}`);

    let cognitoUserId: string;
    try {
      cognitoUserId = getCognitoUserIdFromEvent(request.event);
      logger.info(`Resolved Cognito user ${cognitoUserId} for GetTask`);
    } catch (authError) {
      logger.warn(`Unable to resolve Cognito user for taskId=${taskId}: ${(authError as Error).message}`);
      return Response.notAuthorized({
        message: 'Unauthorized',
      });
    }

    let taskInstance: TaskInstanceItem | undefined;
    try {
      const taskResult = await ddbClient
        .get({
          TableName: TASK_INSTANCE_TABLE_NAME,
          Key: {
            InstanceId: taskId,
          },
        })
        .promise();
      taskInstance = taskResult.Item as TaskInstanceItem | undefined;
      if (!taskInstance) {
        logger.warn(`Task instance not found in table for taskId=${taskId}`);
        return Response.notFound({
          message: 'Task not found',
        });
      }
      logger.info(
        `Loaded task instance ${taskId} with courseId=${taskInstance.CourseId}, courseWorkId=${taskInstance.ItemId}`,
      );
    } catch (ddbError) {
      if (isAWSError(ddbError)) {
        logger.error(
          `DynamoDB failure loading task instance ${taskId}: ${ddbError.code} - ${ddbError.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task',
          details: `DynamoDB error: ${ddbError.code}`,
        });
      }

      logger.error(
        `Unexpected error reading task instance ${taskId}: ${JSON.stringify(ddbError)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task',
      });
    }

    const courseId = taskInstance.CourseId?.trim();
    const courseWorkId = taskInstance.ItemId?.trim();
    const experienceId = taskInstance.ExperienceId?.trim();
    const entryId = taskInstance.EntryId?.trim();
    const fallbackTitle = taskInstance.CatalogEntryName?.trim();
    const attachmentId = taskInstance.AttachmentId?.trim();

    if (!courseId || !courseWorkId || !experienceId || !entryId) {
      logger.error(
        `Task instance ${taskId} missing required metadata:` +
        ` courseId=${courseId}, courseWorkId=${courseWorkId},` +
        ` experienceId=${experienceId}, entryId=${entryId}`,
      );
      return Response.internalFailure({
        message: 'Task metadata incomplete',
      });
    }

    if (!attachmentId) {
      logger.error(
        `Task instance ${taskId} is missing attachmentId; Google Classroom` +
        ' requires attachmentId for student contexts.',
      );
      return Response.internalFailure({
        message: 'Task metadata incomplete',
      });
    }

    logger.info(
      `Authorizing user ${cognitoUserId} against Classroom` +
      `courseId=${courseId}, courseWorkId=${courseWorkId}`,
    );

    let oAuth2Client;
    try {
      oAuth2Client = await getGoogleOAuthClient(cognitoUserId);
    } catch (oauthError) {
      if (
        oauthError instanceof Error &&
        oauthError.name === 'OAuthTokensForUserNotFoundError'
      ) {
        logger.warn(
          `No Google OAuth token found for Cognito user ${cognitoUserId} ` +
          `while accessing taskId=${taskId}`,
        );
        return Response.notAuthorized({
          message: 'Google account not linked',
        });
      }

      logger.error(
        `Failed to build Google OAuth client for user ${cognitoUserId}:` +
        ` ${oauthError instanceof Error ? oauthError.message : JSON.stringify(oauthError)}`,
      );
      return Response.internalFailure({
        message: 'Failed to authorize with Google Classroom',
      });
    }

    const classroomApi = classroom({ version: 'v1', auth: oAuth2Client });

    let isAuthorized = false;
    let resolvedRole: 'TEACHER' | 'STUDENT' | 'UNKNOWN' = 'UNKNOWN';

    const getAddOnContext = classroomApi.courses?.courseWork?.getAddOnContext?.bind(
      classroomApi.courses.courseWork,
    );

    if (getAddOnContext) {
      logger.info(
        `Attempting courseWork.getAddOnContext for user ${cognitoUserId}` +
        ` (courseId=${courseId}, courseWorkId=${courseWorkId},` +
        ` attachmentId=${attachmentId})`,
      );

      try {
        const addOnContextResult = await getAddOnContext({
          courseId,
          itemId: courseWorkId,
          attachmentId,
        });
        const teacherContext = addOnContextResult.data?.teacherContext ?? null;
        const studentContext = addOnContextResult.data?.studentContext ?? null;

        logger.info(
          'AddOnContext returned teacherContext=' +
          ` ${teacherContext ? 'present' : 'absent'},` +
          ` studentContext=${studentContext ? 'present' : 'absent'} for` +
          ` taskId=${taskId}`,
        );

        if (teacherContext) {
          isAuthorized = true;
          resolvedRole = 'TEACHER';
        } else if (studentContext) {
          isAuthorized = true;
          resolvedRole = 'STUDENT';
          if (studentContext.submissionId) {
            logger.info(
              `Captured submissionId=${studentContext.submissionId} for user` +
              ` ${cognitoUserId}`,
            );
          }
        } else {
          logger.error(
            'AddOnContext did not include teacher or student context for ' +
            `taskId=${taskId}`,
          );
          return Response.internalFailure({
            message: 'Unable to determine Google Classroom context for task',
          });
        }
      } catch (contextError) {
        if (isGaxiosError(contextError)) {
          const status = contextError.response?.status;
          const statusText = contextError.response?.statusText ?? 'Unknown status';

          logger.error(
            `AddOnContext failed with status ${status} (${statusText}) for` +
            ` user ${cognitoUserId}:` +
            ` ${JSON.stringify(contextError.response?.data)}`,
          );
          return Response.internalFailure({
            message: 'Failed to verify Google Classroom context',
            details: statusText,
          });
        } else {
          logger.error(
            'Unexpected error during AddOnContext lookup:' +
            ` ${contextError instanceof Error ? contextError.message : JSON.stringify(contextError)}`,
          );
          return Response.internalFailure({
            message: 'Failed to verify Google Classroom context',
          });
        }
      }
    } else {
      logger.error('Google Classroom client does not expose courseWork.getAddOnContext');
      return Response.internalFailure({
        message: 'Google Classroom context API unavailable',
      });
    }

    logger.info(
      `Authorization succeeded for user ${cognitoUserId} as ${resolvedRole}; loading catalog content for experience ${experienceId}, entry ${entryId}`,
    );

    let catalogEntry: CatalogEntryItem | undefined;
    try {
      const catalogResult = await ddbClient
        .get({
          TableName: TASK_CATALOG_TABLE_NAME,
          Key: {
            ExperienceId: experienceId,
            EntryId: entryId,
          },
        })
        .promise();
      catalogEntry = catalogResult.Item as CatalogEntryItem | undefined;
      if (!catalogEntry) {
        logger.error(
          `Catalog entry missing for experienceId=${experienceId}, entryId=${entryId}, taskId=${taskId}`,
        );
        return Response.internalFailure({
          message: 'Task content no longer available',
        });
      }
      logger.info(
        `Loaded catalog entry for experienceId=${experienceId}, entryId=${entryId}`,
      );
    } catch (catalogError) {
      if (isAWSError(catalogError)) {
        logger.error(
          `DynamoDB failure loading catalog entry ${experienceId}/${entryId}: ${catalogError.code} - ${catalogError.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task content',
          details: `DynamoDB error: ${catalogError.code}`,
        });
      }

      logger.error(
        `Unexpected error reading catalog entry ${experienceId}/${entryId}: ${JSON.stringify(catalogError)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task content',
      });
    }

    const title = catalogEntry.Name?.trim() || fallbackTitle;
    const subheading = catalogEntry.Subheading?.trim();
    const instructions = catalogEntry.Instructions?.trim();
    const assetIds = catalogEntry.AssetIds;
    const milestones = catalogEntry.Milestones;

    if (!title || !subheading || !instructions) {
      logger.error(
        `Catalog entry missing required fields for experienceId=${experienceId}, entryId=${entryId}. title=${!!title}, subheading=${!!subheading}, instructions=${!!instructions}`,
      );
      return Response.internalFailure({
        message: 'Task content incomplete',
      });
    }

    logger.info(
      `Returning task content for taskId=${taskId}, role=${resolvedRole}, title="${title}"`,
    );

    let experienceName: string;
    let robloxGameId: string;
    let experienceAssetIds: string[] | undefined;
    try {
      const resolvedExperience = await getExperienceWithResolvedName(experienceId, logger);
      experienceName = resolvedExperience.experienceName;
      const resolvedRobloxGameId = resolvedExperience.robloxGameId?.trim();
      if (!resolvedRobloxGameId) {
        logger.error(
          `Resolved experience metadata missing RobloxGameId for experienceId=${experienceId}, taskId=${taskId}`,
        );
        // TODO(metrics): emit a metric when task load fails due to missing RobloxGameId.
        return Response.internalFailure({
          message: 'Task content incomplete',
        });
      }
      robloxGameId = resolvedRobloxGameId;
      experienceAssetIds = resolvedExperience.assetIds;
      logger.info(
        `Loaded resolved experience metadata for experienceId=${experienceId}, name=${experienceName}`,
      );
    } catch (experienceError) {
      logger.error(
        `Failed to resolve experience metadata for experienceId=${experienceId}, taskId=${taskId}: ${(experienceError as Error).message}`,
      );
      // TODO(metrics): emit a metric when task load fails due to unresolved experience metadata.
      return Response.internalFailure({
        message: 'Failed to load task content',
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
      } catch (ddbError) {
        if (isAWSError(ddbError)) {
          logger.error(
            `Failed loading asset ${assetId} for taskId=${taskId}: ${ddbError.code} - ${ddbError.message}`,
          );
          return Response.internalFailure({
            message: 'Failed to load task assets',
            details: `DynamoDB error: ${ddbError.code}`,
          });
        }
        logger.error(
          `Unexpected error loading asset ${assetId} for taskId=${taskId}: ${JSON.stringify(ddbError)}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task assets',
        });
      }

      if (!assetRecord) {
        logger.warn(`Skipping missing asset ${assetId} for taskId=${taskId}`);
        continue;
      }

      if (assetRecord.ExperienceId !== experienceId) {
        logger.warn(
          `Skipping cross-experience asset ${assetId} while loading taskId=${taskId}`,
        );
        continue;
      }

      if (assetRecord.Status !== 'ready') {
        logger.warn(
          `Skipping non-ready asset ${assetId} (status=${assetRecord.Status}) for taskId=${taskId}`,
        );
        continue;
      }

      if (
        !assetRecord.FileName ||
        !assetRecord.ObjectKey ||
        !assetRecord.ContentType ||
        !SUPPORTED_ASSET_CONTENT_TYPES.has(
          assetRecord.ContentType as AssetContentType,
        )
      ) {
        logger.warn(
          `Skipping invalid asset metadata for assetId=${assetId}, taskId=${taskId}`,
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
      } catch (signError) {
        if (isAWSError(signError)) {
          logger.error(
            `Failed creating view URL for assetId=${assetId}, taskId=${taskId}: ${signError.code} - ${signError.message}`,
          );
        } else {
          logger.error(
            `Unexpected error creating view URL for assetId=${assetId}, taskId=${taskId}: ${JSON.stringify(signError)}`,
          );
        }
        return Response.internalFailure({
          message: 'Failed to prepare task assets',
        });
      }

      assets.push({
        assetId: assetId,
        fileName: assetRecord.FileName,
        contentType: assetRecord.ContentType as AssetContentType,
        url: url,
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
        ...(experienceAssetIds !== undefined
          ? { experienceAssetIds }
          : {}),
        ...(milestones !== undefined ? { milestones } : {}),
      },
    });
  } catch (error) {
    if (isGaxiosError(error)) {
      const statusText = error.response?.statusText ?? 'Google API error';
      const statusCode = error.response?.status ?? 'unknown';
      const details = error.response?.data?.error ?? 'Unknown error';
      logger.error(
        `GetTask failed due to Google API error (status=${statusCode}): ${statusText} - ${JSON.stringify(details)}`,
      );
      return Response.internalFailure({
        message: 'Failed to communicate with Google Classroom',
        details: `${statusText}: ${JSON.stringify(details)}`,
      });
    }

    logger.error(`Unhandled error in GetTask: ${JSON.stringify(error)}`);
    return Response.internalFailure({
      message: 'Unexpected error retrieving task',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the GetTask operation.
 * The getTaskHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getTaskHandler(...INTERCEPTORS, getTask);
