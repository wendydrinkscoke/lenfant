import { DynamoDB } from 'aws-sdk';
import {
  listProjectsHandler,
  ListProjectsChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  RobloxLinkRequiredErrorResponseContent,
  Project,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent, getRobloxUserIdForCognitoUser } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const PROJECT_CREATOR_GSI_NAME = 'ProjectCreatorRobloxUserIdIndex';

type ProjectRecord = {
  ExperienceId?: string;
};

/**
 * Type-safe handler for the ListProjects operation
 */
export const listProjects: ListProjectsChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start ListProjects Operation');

  let projectsTableName: string;
  try {
    projectsTableName = getRequiredEnv('PROJECTS_TABLE_NAME');
  } catch (error) {
    logger.error(`Missing required environment variable: ${error}`);
    return Response.internalFailure({
      message: 'Misconfigured lambda environment.',
    });
  }

  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
  } catch (authError) {
    logger.warn((authError as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }
  logger.info(`Cognito User ID: ${cognitoUserId}`);

  let robloxUserId: string;
  try {
    robloxUserId = await getRobloxUserIdForCognitoUser(cognitoUserId);
    logger.info(`Roblox User ID: ${robloxUserId}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'RobloxUserNotLinkedError') {
      logger.warn(
        `No Roblox User ID linked to Cognito user ID ${cognitoUserId}.`,
      );
      return Response.notAuthorized({
        message: `No Roblox User ID linked to Cognito user ID: ${cognitoUserId}.`,
      } as RobloxLinkRequiredErrorResponseContent);
    }

    let errorMessage = 'Unknown error';
    if (isAWSError(error)) {
      errorMessage = `AWS Error (${error.code}) - ${error.message}`;
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }
    logger.error(`Failed to retrieve Roblox User ID: ${errorMessage}`);
    return Response.internalFailure({
      message: `Failed to retrieve Roblox User ID for Cognito user ID ${cognitoUserId}. Error: ${errorMessage}`,
    });
  }

  const projects: Project[] = [];
  let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

  try {
    do {
      const queryInput: DynamoDB.DocumentClient.QueryInput = {
        TableName: projectsTableName,
        IndexName: PROJECT_CREATOR_GSI_NAME,
        KeyConditionExpression: '#creatorId = :creatorId',
        ExpressionAttributeNames: {
          '#creatorId': 'ProjectCreatorRobloxUserId',
        },
        ExpressionAttributeValues: {
          ':creatorId': robloxUserId,
        },
      };

      if (lastEvaluatedKey) {
        queryInput.ExclusiveStartKey = lastEvaluatedKey;
      }

      const queryResult = await ddbClient.query(queryInput).promise();

      const items = (queryResult.Items ?? []) as ProjectRecord[];
      items.forEach((item) => {
        const experienceId =
          typeof item.ExperienceId === 'string'
            ? item.ExperienceId.trim()
            : undefined;
        if (experienceId) {
          projects.push({ experienceId });
        }
      });

      lastEvaluatedKey = queryResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to list projects for robloxUserId=${robloxUserId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to list projects.',
      });
    }

    logger.error(
      `Unexpected error while listing projects for robloxUserId=${robloxUserId}: ${JSON.stringify(
        error,
      )}`,
    );
    return Response.internalFailure({
      message: 'Failed to list projects.',
    });
  }

  return Response.success({
    projects,
  });
};

/**
 * Entry point for the AWS Lambda handler for the ListProjects operation.
 * The listProjectsHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = listProjectsHandler(...INTERCEPTORS, listProjects);
