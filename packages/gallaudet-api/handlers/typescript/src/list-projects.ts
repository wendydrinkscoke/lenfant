import { DynamoDB } from 'aws-sdk';
import {
  listProjectsHandler,
  ListProjectsChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  Project,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';
import { getExperiencesWithResolvedNames } from './utils/experience-metadata-utils';

const ddbClient = new DynamoDB.DocumentClient();

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

  const experienceIds: string[] = [];
  let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

  try {
    do {
      const queryInput: DynamoDB.DocumentClient.QueryInput = {
        TableName: projectsTableName,
        KeyConditionExpression: '#cognitoUserId = :cognitoUserId',
        ExpressionAttributeNames: {
          '#cognitoUserId': 'CognitoUserId',
        },
        ExpressionAttributeValues: {
          ':cognitoUserId': cognitoUserId,
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
          experienceIds.push(experienceId);
        }
      });

      lastEvaluatedKey = queryResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to list projects for cognitoUserId=${cognitoUserId}: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to list projects.',
      });
    }

    logger.error(
      `Unexpected error while listing projects for cognitoUserId=${cognitoUserId}: ${JSON.stringify(
        error,
      )}`,
    );
    return Response.internalFailure({
      message: 'Failed to list projects.',
    });
  }

  let resolvedExperiencesById: Map<string, { experienceName: string }>;
  try {
    resolvedExperiencesById = await getExperiencesWithResolvedNames(experienceIds, logger);
  } catch (error) {
    logger.error(
      `Failed to resolve project metadata for cognitoUserId=${cognitoUserId}: ${(error as Error).message}`,
    );
    // TODO(metrics): emit a metric when project listing fails during experience metadata resolution.
    return Response.internalFailure({
      message: 'Failed to list projects.',
    });
  }

  const projects: Project[] = [];
  for (const experienceId of experienceIds) {
    const resolvedExperience = resolvedExperiencesById.get(experienceId);
    if (!resolvedExperience) {
      logger.error(
        `Resolved project metadata missing for cognitoUserId=${cognitoUserId}, experienceId=${experienceId}`,
      );
      // TODO(metrics): emit a metric when ListProjects encounters missing resolved metadata.
      return Response.internalFailure({
        message: 'Failed to list projects.',
      });
    }

    projects.push({
      experienceId,
      experienceName: resolvedExperience.experienceName,
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
