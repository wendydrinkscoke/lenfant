import { DynamoDB } from 'aws-sdk';
import {
  createProjectHandler,
  CreateProjectChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  PlaceIdProvidedErrorResponseContent,
  ProjectAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';
import {
  lookupRobloxUniverse,
  lookupRobloxUniverseForPlace,
} from './utils/roblox-utils';

const ddbClient = new DynamoDB.DocumentClient();

const isProjectAlreadyCreatedError = (error: unknown): boolean => {
  if (!isAWSError(error) || error.code !== 'TransactionCanceledException') {
    return false;
  }

  const cancellationReasons = (error as { cancellationReasons?: Array<{ Code?: string }> })
    .cancellationReasons;
  if (cancellationReasons?.some((reason) => reason?.Code === 'ConditionalCheckFailed')) {
    return true;
  }

  return error.message.includes('ConditionalCheckFailed');
};

/**
 * Type-safe handler for the CreateProject operation
 */
export const createProject: CreateProjectChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CreateProject Operation');

  // 1. Get environment variables needed
  let projectsTableName: string;
  let experiencesTableName: string;
  try {
    projectsTableName = getRequiredEnv('PROJECTS_TABLE_NAME');
    experiencesTableName = getRequiredEnv('EXPERIENCES_TABLE_NAME');
  } catch (error) {
    logger.error(`Missing required environment variable: ${error}`);
    return Response.internalFailure({
      message: 'Misconfigured lambda environment.',
    });
  }

  // 2. Extract the universe ID from the request
  const { experienceId } = request.input.requestParameters;
  const trimmedExperienceId = experienceId.trim();
  logger.info(`Requested Experience ID: ${trimmedExperienceId}`);

  if (!/^\d+$/.test(trimmedExperienceId)) {
    return Response.badRequest({
      message: 'Experience ID must contain only numbers.',
    });
  }

  // 3. Get calling Cognito user id
  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
    logger.info(`Cognito User ID: ${cognitoUserId}`);
  } catch (error) {
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }

  let experienceName: string;
  try {
    const universeLookup = await lookupRobloxUniverse(trimmedExperienceId);
    if (universeLookup.status === 'found') {
      experienceName = universeLookup.experienceName;
    } else {
      const placeLookup = await lookupRobloxUniverseForPlace(trimmedExperienceId);
      if (placeLookup.status === 'found') {
        const body: PlaceIdProvidedErrorResponseContent = {
          message: `The provided ID ${trimmedExperienceId} appears to be a Roblox place ID. Use universe ID ${placeLookup.universeId} instead.`,
          suggestedUniverseId: placeLookup.universeId,
        };
        return {
          statusCode: 422,
          body,
        };
      }

      return Response.badRequest({
        message: `Experience ID ${trimmedExperienceId} does not correspond to a valid Roblox universe.`,
      });
    }
  } catch (error) {
    logger.error(
      `Failed to validate experienceId=${trimmedExperienceId} with Roblox: ${(error as Error).message}`,
    );
    // TODO(metrics): emit a metric when create-project cannot validate an experience ID with Roblox.
    return Response.internalFailure({
      message: 'Failed to validate experience ID with Roblox.',
    });
  }

  // 4. Create a project row scoped to the calling Cognito user and seed canonical experience metadata.
  const nowIso = new Date().toISOString();
  const projectItem = {
    CognitoUserId: cognitoUserId,
    ExperienceId: trimmedExperienceId,
    CreatedAt: nowIso,
  };
  logger.info(`Creating Project item: ${JSON.stringify(projectItem)}`);
  try {
    await ddbClient.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: projectsTableName,
            Item: projectItem,
            ConditionExpression:
              'attribute_not_exists(CognitoUserId) AND attribute_not_exists(ExperienceId)',
          },
        },
        {
          Update: {
            TableName: experiencesTableName,
            Key: {
              ExperienceId: trimmedExperienceId,
            },
            UpdateExpression:
              'SET #experienceName = :experienceName, #experienceNameFetchedAt = :experienceNameFetchedAt, #updatedAt = :updatedAt, #createdAt = if_not_exists(#createdAt, :createdAt)',
            ExpressionAttributeNames: {
              '#experienceName': 'ExperienceName',
              '#experienceNameFetchedAt': 'ExperienceNameFetchedAt',
              '#updatedAt': 'UpdatedAt',
              '#createdAt': 'CreatedAt',
            },
            ExpressionAttributeValues: {
              ':experienceName': experienceName,
              ':experienceNameFetchedAt': nowIso,
              ':updatedAt': nowIso,
              ':createdAt': nowIso,
            },
          },
        },
      ],
    }).promise();
    logger.info(`Created new project entry: ${JSON.stringify(projectItem)}`);
  } catch (error) {
    if (isProjectAlreadyCreatedError(error)) {
      logger.warn(
        `Project with ExperienceId ${trimmedExperienceId} already exists for CognitoUserId ${cognitoUserId}.`,
      );
      const body: ProjectAlreadyExistsErrorResponseContent = {
        message: `A project for experienceId ${trimmedExperienceId} already exists for this user.`,
      };
      return { statusCode: 409, body };
    } else if (isAWSError(error)) {
      logger.error(`DynamoDB AWS Error (${error.code}): ${error.message}`);
      return Response.internalFailure({
        message: `Failed to create new project entry in the database. AWS Error (${error.code}): ${error.message}`,
      });
    }
    logger.error(`Failed to create project entry: ${error}`);
    // TODO(metrics): emit a metric when create-project fails during the transactional write.
    return Response.internalFailure({
      message: 'Failed to create new project entry in the database.',
    });
  }

  // 5. Return a successful response including the created Project item
  return Response.success({
    message: 'Project created successfully.',
  });
};

/**
 * Entry point for the AWS Lambda handler for the CreateProject operation.
 * The createProjectHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = createProjectHandler(...INTERCEPTORS, createProject);
