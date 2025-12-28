import { classroom } from '@googleapis/classroom';
import { DynamoDB } from 'aws-sdk';
import {
  gradeTaskHandler,
  GradeTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getExperienceIdFromEvent, getGoogleOAuthClient } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';
import { extractGoogleUserIdFromUsername } from './utils/google-utils';

const ddbClient = new DynamoDB.DocumentClient();
const USERS_TABLE_NAME = getRequiredEnv('USERS_TABLE_NAME');
const TASK_INSTANCE_TABLE_NAME = getRequiredEnv('TASK_INSTANCE_TABLE_NAME');
const ROBLOX_USER_GSI_NAME = 'RobloxUserIdIndex';

type UserMappingRecord = {
  CognitoUserId?: string;
  RobloxUserId?: string;
  Username?: string;
};

type TaskInstanceRecord = {
  InstanceId?: string;
  PartnerId?: string;
  CourseId?: string;
  ItemId?: string;
  AttachmentId?: string;
  CreatedBy?: string;
  Grades?: Record<string, number>;
};

type StudentSubmissionSummary = {
  id?: string | null;
  userId?: string | null;
};

type StudentSubmissionsListResponse = {
  data?: {
    studentSubmissions?: StudentSubmissionSummary[];
    nextPageToken?: string | null;
  };
};

/**
 * Type-safe handler for the GradeTask operation
 */
export const gradeTask: GradeTaskChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GradeTask Operation');

  let experienceId: string;
  try {
    experienceId = await getExperienceIdFromEvent(request.event);
  } catch (error) {
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Valid API key required',
    });
  }
  logger.info(`Resolved experienceId=${experienceId} from API key`);

  const { input } = request;
  const robloxUserId = input.requestParameters?.robloxUserId?.trim();
  const taskId = input.requestParameters?.taskId?.trim();
  const percentageValue = input.body?.percentage;

  if (!robloxUserId || !taskId) {
    logger.warn(
      `Missing required path parameters: robloxUserId=${robloxUserId}, taskId=${taskId}`,
    );
    return Response.badRequest({
      message: 'robloxUserId and taskId are required',
    });
  }

  if (typeof percentageValue !== 'number' || Number.isNaN(percentageValue)) {
    logger.warn('Percentage value missing or not a number');
    return Response.badRequest({
      message: 'percentage is required',
    });
  }
  if (percentageValue < 0 || percentageValue > 100) {
    logger.warn(`percentage ${percentageValue} outside accepted range`);
    return Response.badRequest({
      message: 'percentage must be between 0 and 100',
    });
  }

  logger.info(
    `Grading request received for robloxUserId=${robloxUserId}, taskId=${taskId}, percentage=${percentageValue}`,
  );

  // Step 1: Look up the student's Cognito user ID from the RobloxUserIdIndex on the Users table.
  let studentMapping: UserMappingRecord | undefined;
  try {
    logger.info(
      `Querying ${USERS_TABLE_NAME} (index=${ROBLOX_USER_GSI_NAME}) for robloxUserId=${robloxUserId}`,
    );
    const result = await ddbClient
      .query({
        TableName: USERS_TABLE_NAME,
        IndexName: ROBLOX_USER_GSI_NAME,
        KeyConditionExpression: '#robloxUserId = :robloxUserId',
        ExpressionAttributeNames: {
          '#robloxUserId': 'RobloxUserId',
        },
        ExpressionAttributeValues: {
          ':robloxUserId': robloxUserId,
        },
        Limit: 1,
        ConsistentRead: false,
      })
      .promise();
    studentMapping = (result.Items?.[0] as UserMappingRecord | undefined) ?? undefined;
    logger.info(
      `Student mapping lookup returned ${result.Items?.length ?? 0} item(s)`,
    );
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(
        `Failed querying ${USERS_TABLE_NAME} for robloxUserId=${robloxUserId}: ${ddbError.code} - ${ddbError.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to load player mapping',
        details: `DynamoDB error: ${ddbError.code}`,
      });
    }

    logger.error(
      `Unexpected error querying ${USERS_TABLE_NAME} for robloxUserId=${robloxUserId}: ${JSON.stringify(ddbError)}`,
    );
    return Response.internalFailure({
      message: 'Failed to load player mapping',
    });
  }

  if (!studentMapping?.CognitoUserId) {
    logger.warn(
      `No Cognito mapping found for robloxUserId=${robloxUserId}`,
    );
    return Response.badRequest({
      message: 'Player is not linked to a Google account',
    });
  }

  const studentCognitoUserId = studentMapping.CognitoUserId.trim();
  const studentGoogleUserId = extractGoogleUserIdFromUsername(
    studentMapping.Username,
  );
  if (!studentGoogleUserId) {
    logger.warn(
      `Unable to derive Google user ID from Username=${studentMapping.Username}; proceeding with implicit student context`,
    );
  } else {
    logger.info(
      `Resolved student CognitoUserId=${studentCognitoUserId}, googleUserId=${studentGoogleUserId}`,
    );
  }

  // Step 2: Query the task instance record to gather metadata for grading.
  let taskInstance: TaskInstanceRecord | undefined;
  try {
    logger.info(`Loading task instance ${taskId} from ${TASK_INSTANCE_TABLE_NAME}`);
    const taskResult = await ddbClient
      .get({
        TableName: TASK_INSTANCE_TABLE_NAME,
        Key: {
          InstanceId: taskId,
        },
      })
      .promise();
    taskInstance = taskResult.Item as TaskInstanceRecord | undefined;
    logger.info(
      `Task instance lookup ${taskInstance ? 'succeeded' : 'returned no item'} for taskId=${taskId}`,
    );
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(
        `Failed loading task instance ${taskId}: ${ddbError.code} - ${ddbError.message}`,
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

  if (!taskInstance) {
    logger.warn(`Task instance ${taskId} not found`);
    return Response.badRequest({
      message: 'Task not found',
    });
  }

  // Verification 1: Confirm the task belongs to the invoking partner.
  if (taskInstance.PartnerId?.trim() !== experienceId) {
    logger.warn(
      `Partner mismatch while grading task ${taskId}: expected ${taskInstance.PartnerId}, received ${experienceId}`,
    );
    return Response.notAuthorized({
      message: 'Partner not authorized to grade this task',
    });
  }

  const courseId = taskInstance.CourseId?.trim();
  const courseWorkId = taskInstance.ItemId?.trim();
  const attachmentId = taskInstance.AttachmentId?.trim();
  const teacherCognitoUserId = taskInstance.CreatedBy?.trim();

  // Step 3: Capture the teacher's Cognito ID and Classroom identifiers for the assignment.
  if (!courseId || !courseWorkId || !attachmentId || !teacherCognitoUserId) {
    logger.error(
      `Task instance ${taskId} missing metadata. courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}, createdBy=${teacherCognitoUserId}`,
    );
    return Response.internalFailure({
      message: 'Task metadata incomplete',
    });
  }

  logger.info(
    `Task metadata: courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}, teacherCognitoUserId=${teacherCognitoUserId}`,
  );

  // If this student already has a higher grade recorded, keep it to preserve their best attempt.
  const existingGrades = (taskInstance.Grades ?? {}) as Record<string, number>;
  const existingGradeForStudent = existingGrades[studentCognitoUserId];
  const normalizedExistingGrade =
    typeof existingGradeForStudent === 'number' && !Number.isNaN(existingGradeForStudent)
      ? existingGradeForStudent
      : undefined;

  if (normalizedExistingGrade !== undefined && percentageValue < normalizedExistingGrade) {
    logger.info(
      `Skipping grade update for student ${studentCognitoUserId} on task ${taskId}: incoming grade ${percentageValue} is lower than existing grade ${normalizedExistingGrade}`,
    );
    return Response.success({
      message: 'Existing grade is higher; keeping best score',
    });
  }

  // Steps 4 & 5: Retrieve the teacher's OAuth tokens and instantiate a Classroom client.
  let studentOAuthClient;
  logger.info(`Loading Google OAuth client for student CognitoUserId=${studentCognitoUserId}`);
  try {
    studentOAuthClient = await getGoogleOAuthClient(studentCognitoUserId);
  } catch (oauthError) {
    if (
      oauthError instanceof Error &&
      oauthError.name === 'OAuthTokensForUserNotFoundError'
    ) {
      logger.warn(
        `No Google OAuth token found for student Cognito user ${studentCognitoUserId}; cannot locate submission for task ${taskId}`,
      );
      return Response.notAuthorized({
        message: 'Player Google account not linked',
        details: 'Ask the student to reconnect Google Classroom before grading.',
      });
    }

    logger.error(
      `Failed to build Google OAuth client for student ${studentCognitoUserId}: ${
        oauthError instanceof Error
          ? oauthError.message
          : JSON.stringify(oauthError)
      }`,
    );
    return Response.internalFailure({
      message: 'Failed to authorize student with Google Classroom',
    });
  }

  const studentClassroomApi = classroom({ version: 'v1', auth: studentOAuthClient });

  let addOnSubmissionId: string | undefined;
  try {
    logger.info(
      `Fetching add-on context for courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}`,
    );
    const addOnContext = await studentClassroomApi.courses.courseWork.getAddOnContext({
      courseId,
      itemId: courseWorkId,
      attachmentId,
    });
    addOnSubmissionId = addOnContext.data?.studentContext?.submissionId?.trim() ?? undefined;
    if (addOnSubmissionId) {
      logger.info(`Add-on context returned submissionId=${addOnSubmissionId}`);
    } else {
      logger.warn(
        'Add-on context did not provide submissionId; will attempt to resolve via student submission list.',
      );
    }
  } catch (error) {
    if (isGaxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText ?? 'Google API error';
      logger.error(
        `Failed to load add-on context for courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}: ${status} - ${statusText}`,
      );

      if (status === 403) {
        return Response.notAuthorized({
          message: 'Student authorization missing required Classroom scopes',
          details: 'Ask the student to re-link Google Classroom and accept all requested permissions.',
        });
      }

      return Response.internalFailure({
        message: 'Failed to resolve add-on submission context',
        details: statusText,
      });
    }

    logger.error(
      `Unexpected error loading add-on context: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to resolve add-on submission context',
    });
  }

  let teacherOAuthClient;
  logger.info(`Loading Google OAuth client for teacher CognitoUserId=${teacherCognitoUserId}`);
  try {
    teacherOAuthClient = await getGoogleOAuthClient(teacherCognitoUserId);
  } catch (oauthError) {
    if (
      oauthError instanceof Error &&
      oauthError.name === 'OAuthTokensForUserNotFoundError'
    ) {
      logger.error(
        `No OAuth token found for teacher Cognito user ${teacherCognitoUserId}; cannot grade task ${taskId}`,
      );
      return Response.internalFailure({
        message: 'Teacher credentials unavailable',
      });
    }

    logger.error(
      `Failed to build OAuth client for teacher ${teacherCognitoUserId}: ${
        oauthError instanceof Error
          ? oauthError.message
          : JSON.stringify(oauthError)
      }`,
    );
    return Response.internalFailure({
      message: 'Failed to authorize with Google Classroom',
    });
  }

  const teacherClassroomApi = classroom({ version: 'v1', auth: teacherOAuthClient });

  let submissionResourceId: string | undefined;
  try {
    let pageToken: string | undefined = undefined;
    do {
      logger.info(
        `Listing student submissions for courseId=${courseId}, courseWorkId=${courseWorkId} (pageToken=${pageToken ?? 'none'})`,
      );
      const submissionsResponse =
        (await studentClassroomApi.courses.courseWork.studentSubmissions.list({
          courseId,
          courseWorkId,
          userId: 'me',
          pageToken,
        })) as StudentSubmissionsListResponse;
      const submissions: StudentSubmissionSummary[] =
        submissionsResponse.data?.studentSubmissions ?? [];
      logger.info(
        `Received ${submissions.length} submission(s) from Classroom API`,
      );
      const match = submissions.find((submission: StudentSubmissionSummary) => submission?.id);
      if (match?.id) {
        submissionResourceId = match.id;
        logger.info(`Matched StudentSubmission resource id=${submissionResourceId} for student`);
        break;
      }
      pageToken = submissionsResponse.data?.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    if (isGaxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText ?? 'Google API error';
      logger.error(
        `Failed to list student submissions for courseId=${courseId}, courseWorkId=${courseWorkId}, userId=me: ${status} - ${statusText}`,
      );

      if (status === 403) {
        return Response.notAuthorized({
          message: 'Student authorization missing required Classroom scopes',
          details: 'Ask the student to re-link Google Classroom and accept all requested permissions.',
        });
      }

      return Response.internalFailure({
        message: 'Failed to load student submission',
        details: statusText,
      });
    }

    logger.error(
      `Unexpected error listing student submissions: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to load student submission',
    });
  }

  if (!submissionResourceId) {
    logger.warn(
      `Student submission not found for robloxUserId=${robloxUserId} (Google user ${studentGoogleUserId}) on task ${taskId}`,
    );
    return Response.badRequest({
      message: 'Student submission not found',
    });
  }

  const submissionIdForPatch = addOnSubmissionId;
  if (!submissionIdForPatch) {
    logger.error(
      `Unable to determine add-on submission identifier for courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}`,
    );
    return Response.internalFailure({
      message: 'Failed to resolve add-on submission identifier',
    });
  }

  if (!/^\d+$/.test(submissionIdForPatch)) {
    logger.error(
      `Add-on submission identifier ${submissionIdForPatch} is not numeric; refusing to patch`,
    );
    return Response.internalFailure({
      message: 'Invalid add-on submission identifier returned by Classroom',
    });
  }

  // Step 6: Patch the add-on submission grade via the Classroom API.
  // Note: This assumes the teacher can grade without requiring the student to turn in the submission.
  try {
    logger.info(
      `Patching add-on submission ${submissionIdForPatch} (StudentSubmission resource id=${submissionResourceId}) with pointsEarned=${percentageValue} (courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId})`,
    );
    logger.info(
      `Patch request payload: ${JSON.stringify({
        courseId,
        itemId: courseWorkId,
        attachmentId,
        submissionId: submissionIdForPatch,
        updateMask: 'pointsEarned',
        requestBody: { pointsEarned: percentageValue },
      })}`,
    );
    await teacherClassroomApi.courses.courseWork.addOnAttachments.studentSubmissions.patch({
      courseId,
      itemId: courseWorkId,
      attachmentId,
      submissionId: submissionIdForPatch,
      updateMask: 'pointsEarned',
      requestBody: {
        pointsEarned: percentageValue,
      },
    });
  } catch (error) {
    if (isGaxiosError(error)) {
      const status = error.response?.status ?? 500;
      const statusText = error.response?.statusText ?? 'Google API error';
      const responseBody =
        error.response?.data !== undefined
          ? JSON.stringify(error.response.data)
          : '<<no response body>>';
      logger.error(
        `Failed to patch add-on submission ${submissionIdForPatch} for task ${taskId}: ${status} - ${statusText}; responseBody=${responseBody}`,
      );
      return Response.internalFailure({
        message: 'Failed to grade task',
        details: statusText,
      });
    }

    logger.error(
      `Unexpected error patching add-on submission ${submissionIdForPatch}: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to grade task',
    });
  }

  logger.info(
    `Successfully graded task ${taskId} for robloxUserId=${robloxUserId} (add-on submissionId=${submissionIdForPatch})`,
  );

  const updatedGrades: Record<string, number> = {
    ...existingGrades,
    [studentCognitoUserId]: percentageValue,
  };
  const updateTimestamp = new Date().toISOString();
  try {
    logger.info(
      `Persisting grade for student ${studentCognitoUserId} on task ${taskId} into ${TASK_INSTANCE_TABLE_NAME}`,
    );
    await ddbClient
      .update({
        TableName: TASK_INSTANCE_TABLE_NAME,
        Key: {
          InstanceId: taskId,
        },
        UpdateExpression: 'SET #grades = :grades, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#grades': 'Grades',
          '#updatedAt': 'UpdatedAt',
        },
        ExpressionAttributeValues: {
          ':grades': updatedGrades,
          ':updatedAt': updateTimestamp,
        },
        ReturnValues: 'NONE',
      })
      .promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed updating grade for task ${taskId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to persist grade',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error updating grade for task ${taskId}: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to persist grade',
    });
  }

  return Response.success({
    message: 'Task graded successfully',
  });
};

/**
 * Entry point for the AWS Lambda handler for the GradeTask operation.
 * The gradeTaskHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = gradeTaskHandler(...INTERCEPTORS, gradeTask);
