import { DynamoDB, SecretsManager } from 'aws-sdk';
import {
  delegateRobloxSecretStoreAccessHandler,
  DelegateRobloxSecretStoreAccessChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { request as gaxiosRequest } from 'gaxios';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError, isGaxiosError } from './utils/error-utils';

const smClient = new SecretsManager();
const ddbClient = new DynamoDB.DocumentClient();

/**
 * Type-safe handler for the DelegateRobloxSecretStoreAccess operation
 */
export const delegateRobloxSecretStoreAccess: DelegateRobloxSecretStoreAccessChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start DelegateRobloxSecretStoreAccess Operation');

  const { input } = request;
  const { code, code_verifier, redirect_uri } = input.body ?? {};

  const cognitoUserId = request.event.requestContext.authorizer?.claims?.sub as string | undefined;
  if (!cognitoUserId) {
    logger.warn('Missing Cognito user id');
    return Response.notAuthorized({ message: 'Authentication required' });
  }

  if (!code || !code_verifier || !redirect_uri) {
    logger.warn('Missing required parameters in request body');
    return Response.badRequest({
      message: 'code, code_verifier, and redirect_uri are required',
    });
  }

  let clientId: string;
  let clientSecret: string;
  let tokensTableName: string;
  try {
    const robloxSecretArn = getRequiredEnv('ROBLOX_OAUTH_CLIENT_SECRET_ARN');
    tokensTableName = getRequiredEnv('OAUTH_TOKENS_TABLE_NAME');
    const secretValue = await smClient.getSecretValue({ SecretId: robloxSecretArn }).promise();
    if (!secretValue.SecretString) {
      throw new Error('SecretString was empty for Roblox OAuth secret');
    }
    ({ clientId, clientSecret } = JSON.parse(secretValue.SecretString));
    logger.info('Retrieved Roblox OAuth client credentials');
  } catch (err) {
    logger.error(`Failed to retrieve Roblox OAuth secret: ${JSON.stringify(err)}`);
    return Response.internalFailure({
      message: 'Failed to retrieve Roblox OAuth client credentials',
    });
  }

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri,
    });

    const tokenResponse = await gaxiosRequest<{
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      token_type?: string;
      expires_in?: number;
    }>({
      url: 'https://apis.roblox.com/oauth/v1/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: body.toString(),
    });

    accessToken = tokenResponse.data.access_token;
    refreshToken = tokenResponse.data.refresh_token;
    logger.info(`Roblox token exchange status: ${tokenResponse.status}, scopes: ${tokenResponse.data.scope}`);

    if (!accessToken) {
      logger.error('Roblox token response missing access_token');
      return Response.internalFailure({
        message: 'Failed to exchange authorization code for tokens',
        details: 'Roblox did not return an access token.',
      });
    }
  } catch (err) {
    const baseError = 'Failed to exchange authorization code for tokens';
    logger.error(`Roblox token exchange error: ${JSON.stringify(err)}`);
    if (isGaxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data as any;
      return Response.internalFailure({
        message: baseError,
        details: `Roblox error occurred: ${status ?? 'unknown'} - ${data?.error ?? 'unknown'} - ${data?.error_description ?? 'unknown'}`,
      });
    }
    return Response.internalFailure({
      message: baseError,
      details: 'An unexpected error occurred while exchanging authorization code.',
    });
  }

  try {
    const Key = { CognitoUserId: cognitoUserId, Provider: 'roblox' };

    let UpdateExpression = 'SET #A = :a';
    const ExpressionAttributeNames: Record<string, string> = { '#A': 'AccessToken' };
    const ExpressionAttributeValues: Record<string, any> = { ':a': accessToken };

    if (refreshToken) {
      UpdateExpression += ', #R = :r';
      ExpressionAttributeNames['#R'] = 'RefreshToken';
      ExpressionAttributeValues[':r'] = refreshToken;
    }

    await ddbClient
      .update({
        TableName: tokensTableName,
        Key,
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
      .promise();

    return Response.success({
      message: 'Success',
    });
  } catch (err) {
    if (isAWSError(err)) {
      logger.error(`Failed to store tokens in DynamoDB: ${err.code} - ${err.message}`);
      return Response.internalFailure({
        message: 'Failed to store tokens in DynamoDB',
        details: `AWS error occurred: ${err.code} - ${err.message}`,
      });
    }
    logger.error(`Unexpected error storing tokens: ${JSON.stringify(err)}`);
    return Response.internalFailure({
      message: 'Failed to store tokens in DynamoDB',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the DelegateRobloxSecretStoreAccess operation.
 * The delegateRobloxSecretStoreAccessHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = delegateRobloxSecretStoreAccessHandler(...INTERCEPTORS, delegateRobloxSecretStoreAccess);
