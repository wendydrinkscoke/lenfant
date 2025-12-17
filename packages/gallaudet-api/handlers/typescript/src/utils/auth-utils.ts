import { APIGatewayProxyEvent } from 'aws-lambda';
import DynamoDB from 'aws-sdk/clients/dynamodb';
import SecretsManager from 'aws-sdk/clients/secretsmanager';
import { OAuth2Client } from 'google-auth-library';
import { getRequiredEnv } from './env-utils';

class OAuthTokensForUserNotFoundError extends Error {
  constructor(cognitoUserId: string) {
    super(`No OAuth token found for Cognito User ID: ${cognitoUserId}`);
    this.name = 'OAuthTokensForUserNotFoundError';
  }
}

class CognitoUserNotParseableFromEventError extends Error {
  constructor() {
    super('Cognito User ID not parseable from event.');
    this.name = 'CognitoUserNotParseableFromEventError';
  }
}

class ApiKeyIdNotParseableFromEventError extends Error {
  constructor() {
    super('API key identifier not parseable from event.');
    this.name = 'ApiKeyIdNotParseableFromEventError';
  }
}

class RobloxUserNotLinkedError extends Error {
  constructor(cognitoUserId: string) {
    super(`Roblox User ID not found for Cognito User ID: ${cognitoUserId}`);
    this.name = 'RobloxUserNotLinkedError';
  }
}

const ddbClient = new DynamoDB.DocumentClient();
const secretsManager = new SecretsManager();
let cachedGoogleOAuthClientSecret: { clientId?: string; clientSecret?: string } | null = null;

export const getGoogleOAuthClient = async (cognitoUserId: string): Promise<OAuth2Client> => {
  const tokensTableName = getRequiredEnv('OAUTH_TOKENS_TABLE_NAME');
  const googleOAuthClientSecretArn = getRequiredEnv('GOOGLE_OAUTH_CLIENT_SECRET_ARN');

  const oauthToken = await ddbClient.get({
    TableName: tokensTableName,
    Key: {
      CognitoUserId: cognitoUserId,
      Provider: 'google',
    },
  }).promise();

  if (!oauthToken.Item) {
    throw new OAuthTokensForUserNotFoundError(cognitoUserId);
  }


  if (!cachedGoogleOAuthClientSecret) {
    const secretValue = await secretsManager.getSecretValue({
      SecretId: googleOAuthClientSecretArn,
    }).promise();
    if (!secretValue.SecretString) {
      throw new Error(
        'Expected client credentials secret to contain SecretString payload.',
      );
    }

    cachedGoogleOAuthClientSecret = JSON.parse(secretValue.SecretString);
  }

  const oauthClientConfig: { clientId?: string; clientSecret?: string } = {
    clientId: cachedGoogleOAuthClientSecret?.clientId,
    clientSecret: cachedGoogleOAuthClientSecret?.clientSecret,
  };

  const oAuth2Client = new OAuth2Client(oauthClientConfig);

  const { AccessToken, RefreshToken } = oauthToken.Item;
  if (!AccessToken || !RefreshToken) {
    console.warn(`Incomplete OAuth token data for user ${cognitoUserId}`);
  }

  oAuth2Client.setCredentials({
    access_token: AccessToken,
    refresh_token: RefreshToken,
  });

  return oAuth2Client;
};

export const getCognitoUserIdFromEvent = (event: APIGatewayProxyEvent): string => {
  const cognitoUserId = event.requestContext.authorizer?.claims.sub;
  if (!cognitoUserId) {
    throw new CognitoUserNotParseableFromEventError();
  }
  return cognitoUserId;
};

export const getRobloxUserIdForCognitoUser = async (cognitoUserId: string): Promise<string> => {
  const usersTableName = getRequiredEnv('USERS_TABLE_NAME');

  const userRecord = await ddbClient.get({
    TableName: usersTableName,
    Key: {
      CognitoUserId: cognitoUserId,
    },
  }).promise();

  if (!userRecord.Item || !userRecord.Item.RobloxUserId) {
    throw new RobloxUserNotLinkedError(cognitoUserId);
  }
  return userRecord.Item.RobloxUserId;
};

export const getApiKeyIdFromEvent = (event: APIGatewayProxyEvent): string => {
  const apiKeyId = event.requestContext.identity.apiKeyId;
  if (!apiKeyId) {
    throw new ApiKeyIdNotParseableFromEventError();
  }
  return apiKeyId;
};
