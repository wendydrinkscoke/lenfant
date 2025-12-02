import { DynamoDB } from 'aws-sdk';
import {
  getGoogleClassroomAccessStatusHandler,
  GetGoogleClassroomAccessStatusChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TOKENS_TABLE_NAME = getRequiredEnv('OAUTH_TOKENS_TABLE_NAME');

type OAuthTokenRecord = {
  CognitoUserId?: string;
  Provider?: string;
  RefreshToken?: string;
};

/**
 * Type-safe handler for the GetGoogleClassroomAccessStatus operation
 */
export const getGoogleClassroomAccessStatus: GetGoogleClassroomAccessStatusChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetGoogleClassroomAccessStatus Operation');

  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
  } catch (authError) {
    logger.warn((authError as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }
  logger.info(`Checking Google Classroom delegation status for CognitoUserId=${cognitoUserId}`);

  try {
    const result = await ddbClient.get({
      TableName: TOKENS_TABLE_NAME,
      Key: {
        CognitoUserId: cognitoUserId,
        Provider: 'google',
      },
      ConsistentRead: true,
    }).promise();

    const refreshToken = (result.Item as OAuthTokenRecord | undefined)?.RefreshToken?.trim();
    const delegated = Boolean(refreshToken);

    if (delegated) {
      logger.info(`Found refresh token for CognitoUserId=${cognitoUserId}`);
    } else {
      logger.info(`No refresh token found for CognitoUserId=${cognitoUserId}`);
    }

    return Response.success({
      delegated,
    });
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(
        `Failed to fetch delegation status for CognitoUserId=${cognitoUserId}: ${ddbError.code} - ${ddbError.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to fetch Google Classroom access status',
        details: `DynamoDB error: ${ddbError.code}`,
      });
    }

    logger.error(
      `Unexpected error fetching delegation status for CognitoUserId=${cognitoUserId}: ${JSON.stringify(ddbError)}`,
    );
    return Response.internalFailure({
      message: 'Failed to fetch Google Classroom access status',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the GetGoogleClassroomAccessStatus operation.
 * The getGoogleClassroomAccessStatusHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getGoogleClassroomAccessStatusHandler(...INTERCEPTORS, getGoogleClassroomAccessStatus);
