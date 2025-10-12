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

    const { courseId, itemId, itemType, addOnToken, partnerId, entryId } = body;

    if (!courseId || !itemId || !itemType || !addOnToken || !partnerId || !entryId) {
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
            PartnerId: partnerId,
            EntryId: entryId,
          },
        })
        .promise();

      if (!Item) {
        logger.warn(`Catalog entry not found for ${partnerId}/${entryId}`);
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
          `Failed to load catalog entry (${partnerId}/${entryId}): ${ddbError.code} - ${ddbError.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task catalog entry',
          details: `DynamoDB error: ${ddbError.code}`,
        });
      }

      logger.error(
        `Unexpected error reading catalog entry (${partnerId}/${entryId}): ${JSON.stringify(ddbError)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task catalog entry',
      });
    }

    const title = `CivicTech Assignment – ${catalogEntryName}`;

    // TODO: Update when we have a teacher-specific page to view task details.
    //  Hard-coding this as a dummy page for now to demonstrate the flow.
    const teacherUri = `${baseUrl}/terms-of-service`;

    // TODO: Update when we have a student-specific page to view task details.
    //  Hard-coding this as a dummy page for now to demonstrate the flow.
    const studentUri = `${baseUrl}/privacy-policy`;


    // TODO: Store details about the task in our backend, indexed by the courseId
    //  and itemId. This will allow us to retrieve the details from the student
    //  and teacher view pages as well as to mark the task as completed when the
    //  student finishes the assignment in-game.

    const addOnAttachments = classroomApi.courses.courseWork.addOnAttachments;

    const { data: listResponse } = await addOnAttachments.list({
      courseId,
      itemId,
    });

    const existing = listResponse.addOnAttachments?.find((attachment) => attachment?.title === title);

    if (existing?.id) {
      await addOnAttachments.patch({
        courseId,
        itemId,
        attachmentId: existing.id,
        updateMask: 'title,teacher_view_uri,student_view_uri',
        requestBody: {
          title,
          teacherViewUri: { uri: teacherUri },
          studentViewUri: { uri: studentUri },
        },
      });

      return Response.success({
        message: 'Attachment updated',
      });
    }

    await addOnAttachments.create({
      courseId,
      itemId,
      addOnToken,
      requestBody: {
        title,
        teacherViewUri: { uri: teacherUri },
        studentViewUri: { uri: studentUri },
      },
    });

    return Response.success({
      message: 'Attachment created',
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
