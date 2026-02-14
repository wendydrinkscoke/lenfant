import { DynamoDB } from 'aws-sdk';
import {
  getRobloxSecretStoreAccessStatusHandler,
  GetRobloxSecretStoreAccessStatusChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();

type RobloxSecretStoreAccessRecord = {
  ApiKey?: string;
};

/**
 * Type-safe handler for the GetRobloxSecretStoreAccessStatus operation
 */
export const getRobloxSecretStoreAccessStatus: GetRobloxSecretStoreAccessStatusChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetRobloxSecretStoreAccessStatus Operation');

  let apiKeysTableName: string;
  try {
    apiKeysTableName = getRequiredEnv('ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME');
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

  const experienceId = request.input.requestParameters.experienceId?.trim();
  if (!experienceId) {
    return Response.badRequest({
      message: 'experienceId is required',
    });
  }

  try {
    const result = await ddbClient.get({
      TableName: apiKeysTableName,
      Key: {
        CognitoUserId: cognitoUserId,
        ExperienceId: experienceId,
      },
      ConsistentRead: true,
    }).promise();

    const apiKey = (result.Item as RobloxSecretStoreAccessRecord | undefined)?.ApiKey?.trim();
    const delegated = Boolean(apiKey);

    return Response.success({
      delegated,
    });
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(
        `Failed to fetch Roblox Secret Store delegation status for cognitoUserId=${cognitoUserId}, experienceId=${experienceId}: ${ddbError.code} - ${ddbError.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to fetch Roblox secret store access status',
      });
    }

    logger.error(
      `Unexpected error fetching Roblox Secret Store delegation status for cognitoUserId=${cognitoUserId}, experienceId=${experienceId}: ${JSON.stringify(
        ddbError,
      )}`,
    );
    return Response.internalFailure({
      message: 'Failed to fetch Roblox secret store access status',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the GetRobloxSecretStoreAccessStatus operation.
 * The getRobloxSecretStoreAccessStatusHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getRobloxSecretStoreAccessStatusHandler(...INTERCEPTORS, getRobloxSecretStoreAccessStatus);
