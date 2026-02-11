import { DynamoDB } from 'aws-sdk';
import {
  createProjectHandler,
  CreateProjectChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  ProjectAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();

type RobloxPlaceUniverseLookupResponse = {
  universeId?: number | string | null;
};

const resolveUniverseIdForPlaceId = async (
  placeId: string,
  logger: ReturnType<typeof LoggingInterceptor.getLogger>,
): Promise<string | null> => {
  const endpoint = `https://apis.roblox.com/universes/v1/places/${placeId}/universe`;
  const response = await fetch(endpoint);
  const bodyText = await response.text();

  if (!response.ok) {
    logger.error(
      `Roblox place lookup failed for id ${placeId}: ${response.status} ${bodyText}`,
    );
    throw new Error('Failed to validate experience ID with Roblox.');
  }

  let parsed: RobloxPlaceUniverseLookupResponse;
  try {
    parsed = JSON.parse(bodyText) as RobloxPlaceUniverseLookupResponse;
  } catch (error) {
    logger.error(
      `Roblox place lookup returned non-JSON payload for id ${placeId}: ${bodyText}`,
    );
    throw new Error('Failed to validate experience ID with Roblox.');
  }

  if (typeof parsed.universeId === 'number' && Number.isFinite(parsed.universeId)) {
    return String(parsed.universeId);
  }
  if (typeof parsed.universeId === 'string') {
    const trimmed = parsed.universeId.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

/**
 * Type-safe handler for the CreateProject operation
 */
export const createProject: CreateProjectChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CreateProject Operation');

  // 1. Get environment variables needed
  let projectsTableName: string;
  try {
    projectsTableName = getRequiredEnv('PROJECTS_TABLE_NAME');
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

  try {
    const resolvedUniverseId = await resolveUniverseIdForPlaceId(trimmedExperienceId, logger);
    if (resolvedUniverseId) {
      return Response.badRequest({
        message: `The provided ID ${trimmedExperienceId} appears to be a Roblox place ID. Use universe ID ${resolvedUniverseId} instead.`,
      });
    }
  } catch (error) {
    logger.error((error as Error).message);
    return Response.internalFailure({
      message: 'Failed to validate experience ID with Roblox.',
    });
  }

  // 4. Create a project row scoped to the calling Cognito user.
  const projectItem = {
    CognitoUserId: cognitoUserId,
    ExperienceId: trimmedExperienceId,
    CreatedAt: new Date().toISOString(),
  };
  logger.info(`Creating Project item: ${JSON.stringify(projectItem)}`);
  try {
    await ddbClient.put({
      TableName: projectsTableName,
      Item: projectItem,
      ConditionExpression: 'attribute_not_exists(CognitoUserId) AND attribute_not_exists(ExperienceId)',
    }).promise();
    logger.info(`Created new project entry: ${JSON.stringify(projectItem)}`);
  } catch (error) {
    if (isAWSError(error) && error.code === 'ConditionalCheckFailedException') {
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
