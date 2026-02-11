import { classroom } from '@googleapis/classroom';
import { DynamoDB } from 'aws-sdk';
import {
  completeMilestoneHandler,
  CompleteMilestoneChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  Milestone,
  CompleteMilestone400OperationResponse,
  CompleteMilestone403OperationResponse,
  CompleteMilestone404OperationResponse,
  CompleteMilestone500OperationResponse,
} from 'gallaudet-api-typescript-runtime';
import { getPartnerIdFromEvent, getGoogleOAuthClient } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';
import { extractGoogleUserIdFromUsername } from './utils/google-utils';
import { normalizeAndAddMilestoneCompletion } from './utils/milestone-utils';

const ddbClient = new DynamoDB.DocumentClient();
const USERS_TABLE_NAME = getRequiredEnv('USERS_TABLE_NAME');
const TASK_INSTANCE_TABLE_NAME = getRequiredEnv('TASK_INSTANCE_TABLE_NAME');
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');
const ROBLOX_USER_GSI_NAME = 'RobloxUserIdIndex';

type UserMappingRecord = {
  CognitoUserId?: string;
  RobloxUserId?: string;
  Username?: string;
};

type MilestoneCompletionsMap = Record<string, string[]>;

type TaskInstanceRecord = {
  InstanceId?: string;
  PartnerId?: string;
  CourseId?: string;
  ItemId?: string;
  AttachmentId?: string;
  CreatedBy?: string;
  EntryId?: string;
  MilestoneCompletions?: MilestoneCompletionsMap;
};

type CatalogEntryRecord = {
  PartnerId?: string;
  EntryId?: string;
  Milestones?: Milestone[];
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

type FailureResponse =
  | CompleteMilestone400OperationResponse
  | CompleteMilestone403OperationResponse
  | CompleteMilestone404OperationResponse
  | CompleteMilestone500OperationResponse;

type HandlerResult<T> = { ok: true; value: T } | { ok: false; response: FailureResponse };
type Logger = ReturnType<typeof LoggingInterceptor.getLogger>;

const loadStudentMapping = async (
  robloxUserId: string,
  logger: Logger,
) : Promise<HandlerResult<UserMappingRecord | undefined>> => {
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
    logger.info(
      `Student mapping lookup returned ${result.Items?.length ?? 0} item(s)`);
    return { ok: true, value: (result.Items?.[0] as UserMappingRecord | undefined) ?? undefined };
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed querying ${USERS_TABLE_NAME} for robloxUserId=${robloxUserId}: ${error.code} - ${error.message}`,
      );
      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Failed to load player mapping',
          details: `DynamoDB error: ${error.code}`,
        }),
      };
    }

    logger.error(
      `Unexpected error querying ${USERS_TABLE_NAME} for robloxUserId=${robloxUserId}: ${JSON.stringify(error)}`,
    );
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to load player mapping',
      }),
    };
  }
};

const loadTaskInstance = async (
  taskId: string,
  logger: Logger,
) : Promise<HandlerResult<TaskInstanceRecord | undefined>> => {
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
    const taskInstance = taskResult.Item as TaskInstanceRecord | undefined;
    logger.info(
      `Task instance lookup ${taskInstance ? 'succeeded' : 'returned no item'} for taskId=${taskId}`,
    );
    return { ok: true, value: taskInstance };
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed loading task instance ${taskId}: ${error.code} - ${error.message}`,
      );
      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Failed to load task',
          details: `DynamoDB error: ${error.code}`,
        }),
      };
    }

    logger.error(
      `Unexpected error reading task instance ${taskId}: ${JSON.stringify(error)}`,
    );
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to load task',
      }),
    };
  }
};

const loadCatalogEntry = async (
  partnerId: string,
  entryId: string,
  logger: Logger,
) : Promise<HandlerResult<CatalogEntryRecord | undefined>> => {
  try {
    logger.info(
      `Loading catalog entry for partnerId=${partnerId}, entryId=${entryId} from TaskCatalog`,
    );
    const catalogResult = await ddbClient
      .get({
        TableName: TASK_CATALOG_TABLE_NAME,
        Key: {
          PartnerId: partnerId,
          EntryId: entryId,
        },
      })
      .promise();
    return { ok: true, value: catalogResult.Item as CatalogEntryRecord | undefined };
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed loading catalog entry ${partnerId}/${entryId}: ${error.code} - ${error.message}`,
      );
      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Failed to load task catalog entry',
          details: `DynamoDB error: ${error.code}`,
        }),
      };
    }

    logger.error(
      `Unexpected error reading catalog entry ${partnerId}/${entryId}: ${JSON.stringify(error)}`,
    );
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to load task catalog entry',
      }),
    };
  }
};

const ensureGoogleOAuthClient = async (
  cognitoUserId: string,
  logger: Logger,
  subject: 'student' | 'teacher',
) : Promise<HandlerResult<any>> => {
  logger.info(`Loading Google OAuth client for ${subject} CognitoUserId=${cognitoUserId}`);
  try {
    const client = await getGoogleOAuthClient(cognitoUserId);
    return { ok: true, value: client };
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'OAuthTokensForUserNotFoundError'
    ) {
      if (subject === 'student') {
        logger.warn(
          `No Google OAuth token found for student Cognito user ${cognitoUserId}`,
        );
        return {
          ok: false,
          response: Response.notAuthorized({
            message: 'Player Google account not linked',
            details: 'Ask the student to reconnect Google Classroom before continuing.',
          }),
        };
      }

      logger.error(
        `No OAuth token found for teacher Cognito user ${cognitoUserId}; cannot update grade`,
      );
      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Teacher credentials unavailable',
        }),
      };
    }

    logger.error(
      `Failed to build Google OAuth client for ${subject} ${cognitoUserId}: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`,
    );

    return {
      ok: false,
      response: Response.internalFailure({
        message:
          subject === 'student'
            ? 'Failed to authorize student with Google Classroom'
            : 'Failed to authorize with Google Classroom',
      }),
    };
  }
};

const resolveSubmissionIdentifiers = async (
  courseId: string,
  courseWorkId: string,
  attachmentId: string,
  studentApi: ReturnType<typeof classroom>,
  logger: Logger,
) : Promise<HandlerResult<{ addOnSubmissionId: string; submissionResourceId: string }>> => {
  let addOnSubmissionId: string | undefined;
  try {
    logger.info(
      `Fetching add-on context for courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}`,
    );
    const addOnContext = await studentApi.courses.courseWork.getAddOnContext({
      courseId,
      itemId: courseWorkId,
      attachmentId,
    });
    addOnSubmissionId = addOnContext.data?.studentContext?.submissionId?.trim() ?? undefined;
    if (addOnSubmissionId) {
      logger.info(`Add-on context returned submissionId=${addOnSubmissionId}`);
    } else {
      logger.warn('Add-on context did not provide submissionId; will resolve via list endpoint.');
    }
  } catch (error) {
    if (isGaxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText ?? 'Google API error';
      logger.error(
        `Failed to load add-on context for courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}: ${status} - ${statusText}`,
      );

      if (status === 403) {
        return {
          ok: false,
          response: Response.notAuthorized({
            message: 'Student authorization missing required Classroom scopes',
            details: 'Ask the student to re-link Google Classroom and accept all requested permissions.',
          }),
        };
      }

      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Failed to resolve add-on submission context',
          details: statusText,
        }),
      };
    }

    logger.error(
      `Unexpected error loading add-on context: ${JSON.stringify(error)}`,
    );
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to resolve add-on submission context',
      }),
    };
  }

  let submissionResourceId: string | undefined;
  try {
    let pageToken: string | undefined;
    do {
      logger.info(
        `Listing student submissions for courseId=${courseId}, courseWorkId=${courseWorkId} (pageToken=${pageToken ?? 'none'})`,
      );
      const listResponse = (await studentApi.courses.courseWork.studentSubmissions.list({
        courseId,
        courseWorkId,
        userId: 'me',
        pageToken,
      })) as StudentSubmissionsListResponse;
      const submissions = listResponse.data?.studentSubmissions ?? [];
      logger.info(`Received ${submissions.length} submission(s) from Classroom API`);
      const match = submissions.find((submission) => submission?.id);
      if (match?.id) {
        submissionResourceId = match.id;
        logger.info(`Matched StudentSubmission resource id=${submissionResourceId}`);
        break;
      }
      pageToken = listResponse.data?.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    if (isGaxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText ?? 'Google API error';
      logger.error(
        `Failed to list student submissions for courseId=${courseId}, courseWorkId=${courseWorkId}, userId=me: ${status} - ${statusText}`,
      );

      if (status === 403) {
        return {
          ok: false,
          response: Response.notAuthorized({
            message: 'Student authorization missing required Classroom scopes',
            details: 'Ask the student to re-link Google Classroom and accept all requested permissions.',
          }),
        };
      }

      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Failed to load student submission',
          details: statusText,
        }),
      };
    }

    logger.error(
      `Unexpected error listing student submissions: ${JSON.stringify(error)}`,
    );
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to load student submission',
      }),
    };
  }

  if (!submissionResourceId) {
    return {
      ok: false,
      response: Response.badRequest({
        message: 'Student submission not found',
      }),
    };
  }

  if (!addOnSubmissionId) {
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to resolve add-on submission identifier',
      }),
    };
  }

  if (!/^\d+$/.test(addOnSubmissionId)) {
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Invalid add-on submission identifier returned by Classroom',
      }),
    };
  }

  return {
    ok: true,
    value: {
      addOnSubmissionId,
      submissionResourceId,
    },
  };
};

const patchSubmissionGrade = async (
  classroomApi: ReturnType<typeof classroom>,
  courseId: string,
  courseWorkId: string,
  attachmentId: string,
  submissionId: string,
  points: number,
  logger: Logger,
) : Promise<HandlerResult<void>> => {
  try {
    logger.info(
      `Patching add-on submission ${submissionId} with pointsEarned=${points} (courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId})`,
    );
    await classroomApi.courses.courseWork.addOnAttachments.studentSubmissions.patch({
      courseId,
      itemId: courseWorkId,
      attachmentId,
      submissionId,
      updateMask: 'pointsEarned',
      requestBody: {
        pointsEarned: points,
      },
    });
    return { ok: true, value: undefined };
  } catch (error) {
    if (isGaxiosError(error)) {
      const statusText = error.response?.statusText ?? 'Google API error';
      logger.error(
        `Failed to patch add-on submission ${submissionId}: ${error.response?.status ?? 500} - ${statusText}`,
      );
      return {
        ok: false,
        response: Response.internalFailure({
          message: 'Failed to grade task',
          details: statusText,
        }),
      };
    }

    logger.error(
      `Unexpected error patching add-on submission ${submissionId}: ${JSON.stringify(error)}`,
    );
    return {
      ok: false,
      response: Response.internalFailure({
        message: 'Failed to grade task',
      }),
    };
  }
};

/**
 * Type-safe handler for the CompleteMilestone operation
 */
export const completeMilestone: CompleteMilestoneChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CompleteMilestone Operation');

  let partnerId: string;
  try {
    partnerId = await getPartnerIdFromEvent(request.event);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to resolve partner from API key: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to resolve partner from API key',
        details: `DynamoDB error: ${error.code}`,
      });
    }
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Valid API key required',
    });
  }
  logger.info(`Resolved partnerId=${partnerId} from API key`);

  const { input } = request;
  const robloxUserId = input.requestParameters?.robloxUserId?.trim();
  const taskId = input.requestParameters?.taskId?.trim();
  const milestoneId = input.requestParameters?.milestoneId?.trim();

  if (!robloxUserId || !taskId || !milestoneId) {
    logger.warn(
      `Missing required path parameters: robloxUserId=${robloxUserId}, taskId=${taskId}, milestoneId=${milestoneId}`,
    );
    return Response.badRequest({
      message: 'robloxUserId, taskId, and milestoneId are required',
    });
  }

  // Step 1: Resolve the student's Cognito identity via the Users table.
  const studentMappingResult = await loadStudentMapping(robloxUserId, logger);
  if (!studentMappingResult.ok) {
    return studentMappingResult.response;
  }

  const studentMapping = studentMappingResult.value;

  if (!studentMapping?.CognitoUserId) {
    logger.warn(`No Cognito mapping found for robloxUserId=${robloxUserId}`);
    return Response.badRequest({
      message: 'Player is not linked to a Google account',
    });
  }

  const studentCognitoUserId = studentMapping.CognitoUserId.trim();
  const studentGoogleUserId = extractGoogleUserIdFromUsername(studentMapping.Username);
  if (studentGoogleUserId) {
    logger.info(
      `Resolved student CognitoUserId=${studentCognitoUserId}, googleUserId=${studentGoogleUserId}`,
    );
  }

  // Step 2: Load the task instance metadata.
  const taskInstanceResult = await loadTaskInstance(taskId, logger);
  if (!taskInstanceResult.ok) {
    return taskInstanceResult.response;
  }

  const taskInstance = taskInstanceResult.value;

  if (!taskInstance) {
    logger.warn(`Task instance ${taskId} not found`);
    return Response.badRequest({
      message: 'Task not found',
    });
  }

  if (taskInstance.PartnerId?.trim() !== partnerId) {
    logger.warn(
      `Partner mismatch while completing milestone ${milestoneId} on task ${taskId}: expected ${taskInstance.PartnerId}, received ${partnerId}`,
    );
    return Response.notAuthorized({
      message: 'Partner not authorized to update this task',
    });
  }

  const courseId = taskInstance.CourseId?.trim();
  const courseWorkId = taskInstance.ItemId?.trim();
  const attachmentId = taskInstance.AttachmentId?.trim();
  const teacherCognitoUserId = taskInstance.CreatedBy?.trim();
  const catalogEntryId = taskInstance.EntryId?.trim();

  if (!courseId || !courseWorkId || !attachmentId || !teacherCognitoUserId || !catalogEntryId) {
    logger.error(
      `Task instance ${taskId} missing metadata: courseId=${courseId}, courseWorkId=${courseWorkId}, attachmentId=${attachmentId}, createdBy=${teacherCognitoUserId}, entryId=${catalogEntryId}`,
    );
    return Response.internalFailure({
      message: 'Task metadata incomplete',
    });
  }

  // Step 3: Load the catalog entry to understand milestone definitions.
  const catalogEntryResult = await loadCatalogEntry(partnerId, catalogEntryId, logger);
  if (!catalogEntryResult.ok) {
    return catalogEntryResult.response;
  }

  const catalogEntry = catalogEntryResult.value;

  const catalogMilestones = catalogEntry?.Milestones ?? [];
  if (catalogMilestones.length === 0) {
    logger.warn(
      `Catalog entry ${partnerId}/${catalogEntryId} has no milestones; cannot complete milestone ${milestoneId}`,
    );
    return Response.badRequest({
      message: 'Task does not define milestones',
    });
  }

  const milestoneCompletions = (taskInstance.MilestoneCompletions ?? {}) as MilestoneCompletionsMap;
  const existingForStudent = milestoneCompletions[studentCognitoUserId] ?? [];

  const normalizationResult = normalizeAndAddMilestoneCompletion(
    catalogMilestones,
    milestoneId,
    existingForStudent,
  );

  if ('error' in normalizationResult) {
    logger.warn(
      `Milestone ${milestoneId} not defined for catalog entry ${partnerId}/${catalogEntryId}`,
    );
    return Response.badRequest({
      message: 'Milestone not defined for task',
    });
  }

  const {
    orderedCompletionIds,
    cumulativePercentage,
    nextMilestone,
  } = normalizationResult;

  if (cumulativePercentage < 0 || cumulativePercentage > 100) {
    logger.error(
      `Computed cumulative percentage ${cumulativePercentage} for task ${taskId} is outside 0-100`,
    );
    return Response.internalFailure({
      message: 'Computed milestone total is invalid',
    });
  }

  const updatedMilestoneCompletions: MilestoneCompletionsMap = {
    ...milestoneCompletions,
    [studentCognitoUserId]: orderedCompletionIds,
  };

  const updateTimestamp = new Date().toISOString();
  try {
    logger.info(
      `Persisting milestone completions for student ${studentCognitoUserId} on task ${taskId}`,
    );
    await ddbClient
      .update({
        TableName: TASK_INSTANCE_TABLE_NAME,
        Key: {
          InstanceId: taskId,
        },
        UpdateExpression: 'SET #milestoneCompletions = :milestoneCompletions, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#milestoneCompletions': 'MilestoneCompletions',
          '#updatedAt': 'UpdatedAt',
        },
        ExpressionAttributeValues: {
          ':milestoneCompletions': updatedMilestoneCompletions,
          ':updatedAt': updateTimestamp,
        },
        ReturnValues: 'NONE',
      })
      .promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed updating milestone completions for task ${taskId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to persist milestone completion',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error updating milestone completions for task ${taskId}: ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to persist milestone completion',
    });
  }

  // Step 4: Synchronize the updated grade with Google Classroom.
  let studentOAuthClient: any;
  const studentOAuthResult = await ensureGoogleOAuthClient(studentCognitoUserId, logger, 'student');
  if (!studentOAuthResult.ok) {
    return studentOAuthResult.response;
  }
  studentOAuthClient = studentOAuthResult.value;

  const teacherOAuthResult = await ensureGoogleOAuthClient(teacherCognitoUserId, logger, 'teacher');
  if (!teacherOAuthResult.ok) {
    return teacherOAuthResult.response;
  }
  const teacherOAuthClient = teacherOAuthResult.value;

  const studentClassroomApi = classroom({ version: 'v1', auth: studentOAuthClient });
  const teacherClassroomApi = classroom({ version: 'v1', auth: teacherOAuthClient });

  const submissionIdentifiersResult = await resolveSubmissionIdentifiers(
    courseId,
    courseWorkId,
    attachmentId,
    studentClassroomApi,
    logger,
  );
  if (!submissionIdentifiersResult.ok) {
    return submissionIdentifiersResult.response;
  }

  const submissionIdentifiers = submissionIdentifiersResult.value;

  const patchResult = await patchSubmissionGrade(
    teacherClassroomApi,
    courseId,
    courseWorkId,
    attachmentId,
    submissionIdentifiers.addOnSubmissionId,
    cumulativePercentage,
    logger,
  );
  if (!patchResult.ok) {
    return patchResult.response;
  }

  logger.info(
    `Successfully recorded milestone ${milestoneId} for task ${taskId}; cumulativePercentage=${cumulativePercentage}`,
  );

  return Response.success({
    updatedCumulativePercentage: cumulativePercentage,
    ...(nextMilestone
      ? {
        nextMilestoneId: nextMilestone.id,
        nextMilestoneName: nextMilestone.name,
        nextMilestonePercentageContribution: nextMilestone.percentageContribution,
      }
      : {}),
  });
};

/**
 * Entry point for the AWS Lambda handler for the CompleteMilestone operation.
 * The completeMilestoneHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = completeMilestoneHandler(...INTERCEPTORS, completeMilestone);
