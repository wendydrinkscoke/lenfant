import { DynamoDB } from 'aws-sdk';
import {
  delegateRobloxSecretStoreAccessHandler,
  DelegateRobloxSecretStoreAccessChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();

/**
 * Type-safe handler for the DelegateRobloxSecretStoreAccess operation
 */
export const delegateRobloxSecretStoreAccess: DelegateRobloxSecretStoreAccessChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start DelegateRobloxSecretStoreAccess Operation');

  const { input } = request;
  const { apiKey, experienceId } = (input.body ?? {}) as any;

  let tableName: string;
  try {
    tableName = getRequiredEnv('ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME');
  } catch (err) {
    logger.error((err as Error).message);
    return Response.internalFailure({
      message: 'Configuration error',
    });
  }

  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
  } catch (err) {
    logger.warn((err as Error).message);
    return Response.notAuthorized({ message: 'Authentication required' });
  }

  if (!apiKey || !experienceId) {
    logger.warn('Missing required parameters in request body');
    return Response.badRequest({
      message: 'apiKey and experienceId are required',
    });
  }

  const now = new Date().toISOString();
  const item = {
    ExperienceId: experienceId,
    ApiKey: apiKey,
    KeyCreatorCognitoUserId: cognitoUserId,
    CreatedAt: now,
    UpdatedAt: now,
  };

  try {
    await ddbClient
      .put({
        TableName: tableName,
        Item: item,
      })
      .promise();
    return Response.success({
      message: 'Success',
    });
  } catch (err) {
    if (isAWSError(err)) {
      logger.error(`Failed to store API key in DynamoDB: ${err.code} - ${err.message}`);
      return Response.internalFailure({
        message: 'Failed to store API key in DynamoDB',
        details: `AWS error occurred: ${err.code} - ${err.message}`,
      });
    }
    logger.error(`Unexpected error storing API key: ${JSON.stringify(err)}`);
    return Response.internalFailure({
      message: 'Failed to store API key in DynamoDB',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the DelegateRobloxSecretStoreAccess operation.
 * The delegateRobloxSecretStoreAccessHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = delegateRobloxSecretStoreAccessHandler(...INTERCEPTORS, delegateRobloxSecretStoreAccess);
