import { classroom } from '@googleapis/classroom';
import { DynamoDB } from 'aws-sdk';
import {
  listTasksForPlayerHandler,
  ListTasksForPlayerChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  Milestone,
} from 'gallaudet-api-typescript-runtime';

import { getExperienceIdFromEvent, getGoogleOAuthClient } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';
import { computeMilestoneProgress } from './utils/milestone-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_INSTANCE_TABLE_NAME = getRequiredEnv('TASK_INSTANCE_TABLE_NAME');
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');
const USERS_TABLE_NAME = getRequiredEnv('USERS_TABLE_NAME');
const ROBLOX_USER_GSI_NAME = 'RobloxUserIdIndex';
const TASK_INSTANCE_ATTACHMENT_GSI_NAME = 'AttachmentIdIndex';

type TaskInstanceRecord = {
  InstanceId?: string;
  EntryId?: string;
  PartnerId?: string;
  AttachmentId?: string;
  MilestoneCompletions?: Record<string, string[]>;
  Grades?: Record<string, number>;
};

type CatalogEntryRecord = {
  ExperienceId?: string;
  EntryId?: string;
  Milestones?: Milestone[];
  Name?: string;
  Subheading?: string;
  Instructions?: string;
};

const listCoursesForStudent = async (logger: ReturnType<typeof LoggingInterceptor.getLogger>, classroomApi: ReturnType<typeof classroom>) => {
  const courseIds: string[] = [];
  let pageToken: string | undefined;

  do {
    try {
      const response = await classroomApi.courses.list({
        studentId: 'me',
        courseStates: ['ACTIVE'],
        pageToken,
      });
      const courses = response.data?.courses ?? [];
      courses.forEach((course) => {
        if (course?.id) {
          courseIds.push(course.id);
        }
      });
      pageToken = response.data?.nextPageToken ?? undefined;
    } catch (error) {
      if (isGaxiosError(error)) {
        logger.error(
          `Failed to list Classroom courses: ${error.response?.status} - ${error.response?.statusText}`,
        );
      } else {
        logger.error(
          `Unexpected error listing Classroom courses: ${JSON.stringify(error)}`,
        );
      }
      throw error;
    }
  } while (pageToken);

  return courseIds;
};

const listCourseWorkIds = async (
  logger: ReturnType<typeof LoggingInterceptor.getLogger>,
  classroomApi: ReturnType<typeof classroom>,
  courseId: string,
) => {
  const courseWorkIds: string[] = [];
  let pageToken: string | undefined;

  do {
    try {
      const response = await classroomApi.courses.courseWork.list({
        courseId,
        pageToken,
      });
      const courseWork = response.data?.courseWork ?? [];
      courseWork.forEach((item) => {
        if (item?.id) {
          courseWorkIds.push(item.id);
        }
      });
      pageToken = response.data?.nextPageToken ?? undefined;
    } catch (error) {
      if (isGaxiosError(error)) {
        logger.error(
          `Failed to list coursework for course ${courseId}: ${error.response?.status} - ${error.response?.statusText}`,
        );
      } else {
        logger.error(
          `Unexpected error listing coursework for course ${courseId}: ${JSON.stringify(error)}`,
        );
      }
      throw error;
    }
  } while (pageToken);

  return courseWorkIds;
};

const listAddOnAttachmentIds = async (
  logger: ReturnType<typeof LoggingInterceptor.getLogger>,
  classroomApi: ReturnType<typeof classroom>,
  courseId: string,
  courseWorkId: string,
) => {
  const attachmentIds = new Set<string>();
  let pageToken: string | undefined;

  do {
    try {
      const response = await classroomApi.courses.courseWorkMaterials.addOnAttachments.list({
        courseId,
        itemId: courseWorkId,
        pageToken,
      });
      const attachments = response.data?.addOnAttachments ?? [];
      attachments.forEach((attachment) => {
        const attachmentId = attachment?.id;
        if (attachmentId) {
          attachmentIds.add(attachmentId);
        }
      });
      pageToken = response.data?.nextPageToken ?? undefined;
    } catch (error) {
      if (isGaxiosError(error)) {
        logger.error(
          `Failed to list add-on attachments for courseWork ${courseWorkId}: ${error.response?.status} - ${error.response?.statusText}`,
        );
      } else {
        logger.error(
          `Unexpected error listing add-on attachments for courseWork ${courseWorkId}: ${JSON.stringify(error)}`,
        );
      }
      throw error;
    }
  } while (pageToken);

  return attachmentIds;
};

/**
 * Retrieves add-on task instances for a Roblox player by walking the Google
 * Classroom courses → coursework → add-on attachment chain, which currently
 * requires the broader `classroom.coursework.me.readonly` and
 * `classroom.courses.readonly` scopes for students.
 */
export const listTasksForPlayer: ListTasksForPlayerChainedHandlerFunction = async (
  request,
) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start ListTasksForPlayer Operation');
  logger.info(
    `Incoming requestParameters: ${JSON.stringify(
      request.input.requestParameters ?? {},
    )}`,
  );

  let experienceId: string;
  try {
    experienceId = await getExperienceIdFromEvent(request.event);
    logger.info(`Resolved experience ID from API key: ${experienceId}`);
    logger.info(
      `API Gateway identity context: ${JSON.stringify(
        request.event.requestContext?.identity ?? {},
      )}`,
    );
  } catch (error) {
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Valid API key required',
    });
  }

  const robloxUserId = request.input.requestParameters?.robloxUserId?.trim();
  if (!robloxUserId) {
    logger.warn('Missing robloxUserId path parameter');
    logger.info(
      `Original robloxUserId raw value: ${request.input.requestParameters?.robloxUserId}`,
    );
    return Response.internalFailure({
      message: 'robloxUserId is required',
    });
  }
  logger.info(
    `Fetching tasks for robloxUserId=${robloxUserId} (experienceId=${experienceId})`,
  );

  let cognitoUserSub: string | undefined;
  try {
    logger.info(
      `Querying ${USERS_TABLE_NAME} (index=${ROBLOX_USER_GSI_NAME}) for robloxUserId=${robloxUserId}`,
    );
    const mappingResult = await ddbClient
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

    const mapping = (mappingResult.Items ?? [])[0] as
      | { CognitoUserId?: string }
      | undefined;

    if (!mapping?.CognitoUserId) {
      logger.info(
        `No user mapping found for robloxUserId=${robloxUserId}; returning empty task list.`,
      );
      return Response.success({
        tasks: [],
      });
    }

    cognitoUserSub = mapping.CognitoUserId;
    logger.info(
      `Retrieved mapping robloxUserId=${robloxUserId} -> CognitoUserId=${cognitoUserSub}`,
    );
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to look up user mapping for robloxUserId=${robloxUserId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to resolve mapped student account',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error while looking up user mapping for robloxUserId=${robloxUserId}: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to resolve mapped student account',
    });
  }

  let oAuth2Client;
  try {
    oAuth2Client = await getGoogleOAuthClient(cognitoUserSub);
    logger.info(
      `Initialized Google OAuth client for Cognito user ${cognitoUserSub}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'OAuthTokensForUserNotFoundError'
    ) {
      logger.warn(
        `No Google OAuth tokens stored for Cognito user ${cognitoUserSub}`,
      );
      return Response.notAuthorized({
        message: 'Google account not linked',
      });
    }

    logger.error(
      `Failed to construct Google OAuth client for user ${cognitoUserSub}: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`,
    );
    return Response.internalFailure({
      message: 'Failed to authorize with Google Classroom',
    });
  }

  const classroomApi = classroom({ version: 'v1', auth: oAuth2Client });

  let courseIds: string[];
  try {
    logger.info('Listing Classroom courses for current student (ACTIVE only)');
    courseIds = await listCoursesForStudent(logger, classroomApi);
  } catch (error) {
    if (isGaxiosError(error)) {
      return Response.internalFailure({
        message: 'Failed to list Google Classroom courses',
        details: error.response?.statusText ?? 'Google API error',
      });
    }

    return Response.internalFailure({
      message: 'Failed to list Google Classroom courses',
    });
  }

  if (courseIds.length === 0) {
    logger.info(
      `No active Classroom courses found for Cognito user ${cognitoUserSub}`,
    );
    return Response.success({
      tasks: [],
    });
  }
  logger.info(
    `Student has ${courseIds.length} active course(s): ${JSON.stringify(
      courseIds,
    )}`,
  );

  const attachmentIds = new Set<string>();

  for (const courseId of courseIds) {
    logger.info(`Processing courseId=${courseId}`);
    let courseWorkIds: string[];
    try {
      courseWorkIds = await listCourseWorkIds(logger, classroomApi, courseId);
      logger.info(
        `Course ${courseId} returned ${courseWorkIds.length} coursework id(s)`,
      );
    } catch (error) {
      if (isGaxiosError(error)) {
        return Response.internalFailure({
          message: 'Failed to list Google Classroom coursework',
          details: error.response?.statusText ?? 'Google API error',
        });
      }

      return Response.internalFailure({
        message: 'Failed to list Google Classroom coursework',
      });
    }

    for (const courseWorkId of courseWorkIds) {
      logger.info(
        `Listing add-on attachments for courseId=${courseId}, courseWorkId=${courseWorkId}`,
      );
      try {
        const addOnAttachmentIds = await listAddOnAttachmentIds(
          logger,
          classroomApi,
          courseId,
          courseWorkId,
        );
        logger.info(
          `courseWorkId=${courseWorkId} yielded ${addOnAttachmentIds.size} add-on attachment id(s)`,
        );
        addOnAttachmentIds.forEach((attachmentId) => attachmentIds.add(attachmentId));
      } catch (error) {
        if (isGaxiosError(error)) {
          return Response.internalFailure({
            message: 'Failed to list Google Classroom add-on attachments',
            details: error.response?.statusText ?? 'Google API error',
          });
        }

        return Response.internalFailure({
          message: 'Failed to list Google Classroom add-on attachments',
        });
      }
    }
  }

  logger.info(
    `Add-on attachment ids collected from Classroom: ${JSON.stringify(
      Array.from(attachmentIds.values()),
    )}`,
  );

  if (attachmentIds.size === 0) {
    logger.info(
      `No CivicTech add-on attachments detected for robloxUserId=${robloxUserId}`,
    );
    return Response.success({
      tasks: [],
    });
  }

  const tasks: Array<{
    taskId: string;
    entryId: string;
    name: string;
    subheading: string;
    instructions: string;
    nextMilestone?: Milestone;
    cumulativePercentage?: number;
  }> = [];
  const seenTaskIds = new Set<string>();
  for (const attachmentId of attachmentIds) {
    let taskRecord: TaskInstanceRecord | undefined;
    try {
      logger.info(
        `Querying TaskInstances by attachmentId=${attachmentId} (index=${TASK_INSTANCE_ATTACHMENT_GSI_NAME})`,
      );
      const result = await ddbClient
        .query({
          TableName: TASK_INSTANCE_TABLE_NAME,
          IndexName: TASK_INSTANCE_ATTACHMENT_GSI_NAME,
          KeyConditionExpression: '#attachmentId = :attachmentId',
          ExpressionAttributeNames: {
            '#attachmentId': 'AttachmentId',
          },
          ExpressionAttributeValues: {
            ':attachmentId': attachmentId,
          },
          Limit: 1,
          ConsistentRead: false,
        })
        .promise();
      taskRecord = (result.Items ?? [])[0] as TaskInstanceRecord | undefined;
      if ((result.Items ?? []).length > 1) {
        logger.warn(
          `AttachmentId=${attachmentId} returned more than one task instance; only the first item is considered.`,
        );
      }
    } catch (error) {
      if (isAWSError(error)) {
        logger.error(
          `DynamoDB failure querying task instances by attachmentId=${attachmentId}: ${error.code} - ${error.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to query task assignments',
          details: `DynamoDB error: ${error.code}`,
        });
      }

      logger.error(
        `Unexpected error querying task instances by attachmentId=${attachmentId}: ${JSON.stringify(error)}`,
      );
      return Response.internalFailure({
        message: 'Failed to query task assignments',
      });
    }

    if (!taskRecord) {
      logger.info(
        `Skipping attachmentId=${attachmentId} because no task instance was found`,
      );
      continue;
    }

    if (taskRecord.PartnerId !== experienceId) {
      logger.info(
        `Skipping attachmentId=${attachmentId} because it is owned by partner=${taskRecord.PartnerId}`,
      );
      continue;
    }

    if (!taskRecord.InstanceId || !taskRecord.EntryId) {
      logger.warn(
        `Skipping attachmentId=${attachmentId} because the task instance is missing required identifiers`,
      );
      continue;
    }

    if (seenTaskIds.has(taskRecord.InstanceId)) {
      logger.info(
        `Skipping duplicate taskId=${taskRecord.InstanceId} discovered via attachmentId=${attachmentId}`,
      );
      continue;
    }

    seenTaskIds.add(taskRecord.InstanceId);
    let milestoneFields: {
      nextMilestone?: Milestone;
      cumulativePercentage?: number;
    } = {};

    let catalogEntry: CatalogEntryRecord | null = null;
    try {
      logger.info(
        `Loading catalog entry to compute milestones for experienceId=${experienceId}, entryId=${taskRecord.EntryId}`,
      );
      const catalogResult = await ddbClient
        .get({
          TableName: TASK_CATALOG_TABLE_NAME,
          Key: {
            ExperienceId: experienceId,
            EntryId: taskRecord.EntryId,
          },
        })
        .promise();
      catalogEntry = (catalogResult.Item as CatalogEntryRecord | undefined) ?? null;
    } catch (error) {
      if (isAWSError(error)) {
        logger.error(
          `Failed loading catalog entry ${experienceId}/${taskRecord.EntryId}: ${error.code} - ${error.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to load task catalog entry',
          details: `DynamoDB error: ${error.code}`,
        });
      }

      logger.error(
        `Unexpected error reading catalog entry ${experienceId}/${taskRecord.EntryId}: ${JSON.stringify(error)}`,
      );
      return Response.internalFailure({
        message: 'Failed to load task catalog entry',
      });
    }

    const name = catalogEntry?.Name?.trim();
    const subheading = catalogEntry?.Subheading?.trim();
    const instructions = catalogEntry?.Instructions?.trim();
    if (!name || !subheading || !instructions) {
      logger.warn(
        `Catalog entry ${experienceId}/${taskRecord.EntryId} missing name, subheading, or instructions; skipping`,
      );
      continue;
    }

    const milestones = catalogEntry?.Milestones ?? [];
    if (milestones.length > 0) {
      const completionsForStudent = (taskRecord.MilestoneCompletions ?? {})[cognitoUserSub] ?? [];
      const progress = computeMilestoneProgress(milestones, completionsForStudent);
      milestoneFields = {
        cumulativePercentage: progress.cumulativePercentage,
        ...(progress.nextMilestone ? { nextMilestone: progress.nextMilestone } : {}),
      };
    } else {
      const gradeForStudent = (taskRecord?.Grades ?? {})[cognitoUserSub];
      milestoneFields = {
        cumulativePercentage: gradeForStudent ?? 0,
      };
    }

    tasks.push({
      taskId: taskRecord.InstanceId,
      entryId: taskRecord.EntryId,
      name,
      subheading,
      ...milestoneFields,
      instructions,
    });
  }

  logger.info(
    `Returning ${tasks.length} assignments for partner ${experienceId} and robloxUserId=${robloxUserId}`,
  );
  logger.info(`Response payload: ${JSON.stringify({ tasks })}`);

  return Response.success({
    tasks,
  });
};

/**
 * Entry point for the AWS Lambda handler for the ListTasksForPlayer operation.
 * The listTasksForPlayerHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = listTasksForPlayerHandler(...INTERCEPTORS, listTasksForPlayer);
