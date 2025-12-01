import { DynamoDB } from 'aws-sdk';
import {
  getLinkedRobloxAccountHandler,
  GetLinkedRobloxAccountChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const USERS_TABLE_NAME = getRequiredEnv('USERS_TABLE_NAME');

type UserMappingRecord = {
  CognitoUserId?: string;
  RobloxUserId?: string;
};

/**
 * Type-safe handler for the GetLinkedRobloxAccount operation
 */
export const getLinkedRobloxAccount: GetLinkedRobloxAccountChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetLinkedRobloxAccount Operation');

  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
  } catch (authError) {
    logger.warn((authError as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }
  logger.info(`Looking up linked Roblox account for CognitoUserId=${cognitoUserId}`);

  try {
    const result = await ddbClient
      .get({
        TableName: USERS_TABLE_NAME,
        Key: { CognitoUserId: cognitoUserId },
        ConsistentRead: true,
      })
      .promise();

    const mapping = result.Item as UserMappingRecord | undefined;
    const robloxUserId = mapping?.RobloxUserId?.trim();
    if (!robloxUserId) {
      logger.info(
        `No Roblox account linked for CognitoUserId=${cognitoUserId}`,
      );
      return Response.badRequest({
        message: 'Roblox account not linked',
      });
    }

    logger.info(
      `Resolved robloxUserId=${robloxUserId} for CognitoUserId=${cognitoUserId}`,
    );
    return Response.success({
      robloxUserId,
    });
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(
        `Failed to fetch Roblox mapping for CognitoUserId=${cognitoUserId}: ${ddbError.code} - ${ddbError.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to fetch linked Roblox account',
        details: `DynamoDB error: ${ddbError.code}`,
      });
    }

    logger.error(
      `Unexpected error fetching Roblox mapping for CognitoUserId=${cognitoUserId}: ${JSON.stringify(ddbError)}`,
    );
    return Response.internalFailure({
      message: 'Failed to fetch linked Roblox account',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the GetLinkedRobloxAccount operation.
 * The getLinkedRobloxAccountHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getLinkedRobloxAccountHandler(...INTERCEPTORS, getLinkedRobloxAccount);
