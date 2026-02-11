import { randomUUID } from 'crypto';
import { classroom } from '@googleapis/classroom';
import { DynamoDB } from 'aws-sdk';
import {
  attachTaskHandler,
  AttachTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';

import { getCognitoUserIdFromEvent, getGoogleOAuthClient } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');
const TASK_INSTANCE_TABLE_NAME = getRequiredEnv('TASK_INSTANCE_TABLE_NAME');

/**
 * Type-safe handler for the AttachTask operation
 */
export const attachTask: AttachTaskChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CreateClassroomAttachment Operation');

  const baseUrl = getRequiredEnv('WEBSITE_BASE_URL').replace(/\/$/, '');

  try {
    const cognitoUserId = getCognitoUserIdFromEvent(request.event);
    const oAuth2Client = await getGoogleOAuthClient(cognitoUserId);
    const classroomApi = classroom({ version: 'v1', auth: oAuth2Client });

    const { input } = request;
    const body = input.body;

    if (!body) {
      logger.warn('CreateClassroomAttachment called without body');
      return Response.badRequest({
        message: 'Missing request body',
      });
    }

    const { courseId, itemId } = input.requestParameters;
    const { itemType, addOnToken, experienceId, entryId } = body;

    if (!courseId || !itemId || !itemType || !addOnToken || !experienceId || !entryId) {
      return Response.badRequest({
        message: 'One or more required fields are missing',
      });
    }

    if (itemType !== 'courseWork') {
      logger.warn(`Unsupported itemType received: ${itemType}`);
      return Response.badRequest({
        message: 'Only courseWork itemType is currently supported',
      });
    }

    let catalogEntryName = entryId;
    try {
      const { Item } = await ddbClient
        .get({
          TableName: TASK_CATALOG_TABLE_NAME,
          Key: {
            ExperienceId: experienceId,
            EntryId: entryId,
          },
        })
        .promise();

      if (!Item) {
        logger.warn(`Catalog entry not found for ${experienceId}/${entryId}`);
        return Response.badRequest({
          message: 'Selected task is no longer available',
        });
      }

      const name = (Item as { Name?: string }).Name;
      if (name?.trim()) {
        catalogEntryName = name.trim();
      }
    } catch (ddbError) {
      if (isAWSError(ddbError)) {
        logger.error(
          `Failed to load catalog entry (${experienceId}/${entryId}): ${ddbError.code} - ${ddbError.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task catalog entry',
          details: `DynamoDB error: ${ddbError.code}`,
        });
      }

      logger.error(
        `Unexpected error reading catalog entry (${experienceId}/${entryId}): ${JSON.stringify(ddbError)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task catalog entry',
      });
    }

    const title = `CivicTech Assignment – ${catalogEntryName}`;

    const taskInstanceId = randomUUID();
    const encodedTaskInstanceId = encodeURIComponent(taskInstanceId);
    const teacherUri = `${baseUrl}/teacher-task-view?taskId=${encodedTaskInstanceId}`;
    const studentUri = `${baseUrl}/student-task-view?taskId=${encodedTaskInstanceId}`;

    const persistTaskInstance = async (attachmentId: string | null) => {
      const nowIso = new Date().toISOString();
      try {
        await ddbClient
          .update({
            TableName: TASK_INSTANCE_TABLE_NAME,
            Key: {
              InstanceId: taskInstanceId,
            },
            UpdateExpression: [
              'SET #courseId = :courseId',
              '#itemId = :itemId',
              '#experienceId = :experienceId',
              '#entryId = :entryId',
              '#catalogEntryName = :catalogEntryName',
              '#attachmentId = :attachmentId',
              '#teacherUri = :teacherUri',
              '#studentUri = :studentUri',
              '#updatedAt = :updatedAt',
              '#createdBy = :createdBy',
              '#createdAt = if_not_exists(#createdAt, :createdAt)',
            ].join(', '),
            ExpressionAttributeNames: {
              '#courseId': 'CourseId',
              '#itemId': 'ItemId',
              '#experienceId': 'ExperienceId',
              '#entryId': 'EntryId',
              '#catalogEntryName': 'CatalogEntryName',
              '#attachmentId': 'AttachmentId',
              '#teacherUri': 'TeacherUri',
              '#studentUri': 'StudentUri',
              '#updatedAt': 'UpdatedAt',
              '#createdBy': 'CreatedBy',
              '#createdAt': 'CreatedAt',
            },
            ExpressionAttributeValues: {
              ':courseId': courseId,
              ':itemId': itemId,
              ':experienceId': experienceId,
              ':entryId': entryId,
              ':catalogEntryName': catalogEntryName,
              ':attachmentId': attachmentId,
              ':teacherUri': teacherUri,
              ':studentUri': studentUri,
              ':updatedAt': nowIso,
              ':createdBy': cognitoUserId,
              ':createdAt': nowIso,
            },
            ReturnValues: 'NONE',
          })
          .promise();
      } catch (ddbWriteError) {
        if (isAWSError(ddbWriteError)) {
          logger.error(
            `Failed to persist task instance ${taskInstanceId}: ${ddbWriteError.code} - ${ddbWriteError.message}`,
          );
        } else {
          logger.error(
            `Unexpected error persisting task instance ${taskInstanceId}: ${JSON.stringify(ddbWriteError)}`,
          );
        }
      }
    };

    const createResult = await classroomApi.courses.courseWork.addOnAttachments.create({
      courseId,
      itemId,
      addOnToken,
      requestBody: {
        title,
        teacherViewUri: { uri: teacherUri },
        studentViewUri: { uri: studentUri },
        studentWorkReviewUri: { uri: studentUri },
        maxPoints: 100,
      },
    });
    const attachment = createResult.data;
    await persistTaskInstance(attachment?.id ?? null);

    return Response.success({
      message: 'Attachment created',
      taskInstanceId,
    });
  } catch (error) {
    logger.error(`Failed to create Classroom attachment: ${JSON.stringify(error)}`);

    if (isGaxiosError(error)) {
      const statusText = error.response?.statusText ?? 'Google API error';
      const details = error.response?.data?.error ?? 'Unknown error';
      return Response.internalFailure({
        message: 'Failed to create Classroom attachment',
        details: `${statusText}: ${details}`,
      });
    }

    return Response.internalFailure({
      message: 'Failed to create Classroom attachment',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the AttachTask operation.
 * The attachTaskHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = attachTaskHandler(...INTERCEPTORS, attachTask);
