import { DynamoDB, SecretsManager } from 'aws-sdk';
import {
  delegateGoogleClassroomAccessHandler,
  DelegateGoogleClassroomAccessChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { OAuth2Client } from 'google-auth-library';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';

const smClient = new SecretsManager();
const ddbClient = new DynamoDB.DocumentClient();

/**
 * Type-safe handler for the DelegateGoogleClassroomAccess operation
 */
export const delegateGoogleClassroomAccess: DelegateGoogleClassroomAccessChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start DelegateGoogleClassroomAccess Operation');
  const cognitoUserId = request.event.requestContext.authorizer?.claims.sub;

  logger.info(`Cognito User ID: ${cognitoUserId}`);
  const { input } = request;
  const { code, code_verifier, redirect_uri } = input.body;
  logger.info(`input body: ${JSON.stringify(input.body)}`);
  const googleOAuthClientSecretArn = getRequiredEnv('GOOGLE_OAUTH_CLIENT_SECRET_ARN');
  const tokensTableName = getRequiredEnv('OAUTH_TOKENS_TABLE_NAME');

  let clientId: string;
  let clientSecret: string;
  try {
    const secretData = await smClient.getSecretValue({
      SecretId: googleOAuthClientSecretArn,
    }).promise();
    ({ clientId, clientSecret } = JSON.parse(secretData.SecretString!));
    logger.info(`Retrieved Google OAuth client ID: ${clientId}`);
  } catch (error) {
    logger.error(`Failed to retrieve secret value: ${error}`);
    return Response.internalFailure({
      message: 'Failed to retrieve the Google OAuth client secret',
    });
  }

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: redirect_uri,
    });

    const { tokens, res } = await oauth2Client.getToken({
      code,
      codeVerifier: code_verifier,
      redirect_uri: redirect_uri,
    });

    logger.info(`Token response status: ${res?.status}`);
    logger.info(`Token scopes: ${tokens.scope}`);

    accessToken = tokens.access_token ?? undefined;
    refreshToken = tokens.refresh_token ?? undefined;

    if (!accessToken) {
      logger.error('No access_token returned by Google.');
      return Response.internalFailure({
        message: 'Failed to exchange authorization code for tokens',
        details: 'Google did not return an access token.',
      });
    }
  } catch (err) {
    const baseError = 'Failed to exchange authorization code for tokens';
    logger.error(`Google error details: ${JSON.stringify(err)}`);
    if (isGaxiosError(err)) {
      if (!err.response) {
        logger.error(`Google error without response: ${JSON.stringify(err)}`);
        return Response.internalFailure({
          message: baseError,
          details: 'Google did not return a response.',
        });
      }
      const { status, data } = err.response;
      return Response.internalFailure({
        message: baseError,
        details: `Google error occurred: ${status} - ${data.error} - ${data.error_description}`,
      });
    } else {
      logger.error(`Unexpected error: ${JSON.stringify(err)}`);
      return Response.internalFailure({
        message: baseError,
        details: 'An unexpected error occurred while exchanging authorization code.',
      });
    }
  }

  logger.info('Successfully exchanged authorization code for tokens');

  try {
    const Key = { CognitoUserId: cognitoUserId, Provider: 'google' };

    let UpdateExpression = 'SET #A = :a';
    const ExpressionAttributeNames: Record<string, string> = { '#A': 'AccessToken' };
    const ExpressionAttributeValues: Record<string, any> = { ':a': accessToken };

    // refresh token is not always present. It's only there on first auth.
    if (refreshToken) {
      UpdateExpression += ', #R = :r';
      ExpressionAttributeNames['#R'] = 'RefreshToken';
      ExpressionAttributeValues[':r'] = refreshToken;
    }

    await ddbClient.update({
      TableName: tokensTableName,
      Key,
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }).promise();

    return Response.success({
      message: 'Success',
    });
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(`AWS error details: ${JSON.stringify(error)}`);
      const { code: awsCode, message } = error;
      return Response.internalFailure({
        message: 'Failed to store tokens in DynamoDB',
        details: `AWS error occurred: ${awsCode} - ${message}`,
      });
    }
    logger.error(`Failed to store tokens in DynamoDB: ${error}`);
    return Response.internalFailure({
      message: 'Failed to store tokens in DynamoDB',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the DelegateGoogleClassroomAccess operation.
 * The delegateGoogleClassroomAccessHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = delegateGoogleClassroomAccessHandler(...INTERCEPTORS, delegateGoogleClassroomAccess);
