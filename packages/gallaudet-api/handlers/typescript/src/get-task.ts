import { classroom } from '@googleapis/classroom';
import { DynamoDB } from 'aws-sdk';
import {
  getTaskHandler,
  GetTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import type { Milestone } from 'gallaudet-api-typescript-runtime';

import { getCognitoUserIdFromEvent, getGoogleOAuthClient } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_INSTANCE_TABLE_NAME = getRequiredEnv('TASK_INSTANCE_TABLE_NAME');
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');

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

type ExperienceItem = {
  ExperienceId: string;
  ExperienceName: string;
  RobloxGameId: string;
  AssetIds?: string[];
}


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

    const EXPERIENCES_TABLE_NAME = getRequiredEnv('EXPERIENCES_TABLE_NAME');
    let experience: ExperienceItem | undefined;
    try {
      const experienceResult = await ddbClient
        .get({
          TableName: EXPERIENCES_TABLE_NAME,
          Key: {
            ExperienceId: experienceId,
          },
        })
        .promise();
      experience = experienceResult.Item as ExperienceItem | undefined;
      if (!experience) {
        logger.error(
          `Experience entry missing for experienceId=${experienceId}, taskId=${taskId}`,
        );
        return Response.internalFailure({
          message: 'Task content no longer available',
        });
      }
      logger.info(
        `Loaded experience entry for experienceId=${experienceId}, Name=${experience.ExperienceName}`,
      );
    } catch (ddbError) {
      if (isAWSError(ddbError)) {
        logger.error(
          `DynamoDB failure loading experience entry ${experienceId}: ${ddbError.code} - ${ddbError.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task content',
          details: `DynamoDB error: ${ddbError.code}`,
        });
      }
      logger.error(
        `Unexpected error reading experience entry ${experienceId}: ${JSON.stringify(ddbError)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task content',
      });
    }
    const experienceName = experience?.ExperienceName ?? experienceId;
    const robloxGameId = experience?.RobloxGameId;
    const experienceAssetIds = experience?.AssetIds;

    return Response.success({
      task: {
        title,
        subheading,
        instructions,
        experienceName,
        robloxGameId,
        ...(assetIds !== undefined ? { assetIds } : {}),
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
