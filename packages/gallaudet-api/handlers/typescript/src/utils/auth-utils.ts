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


const ddbClient = new DynamoDB.DocumentClient();
const secretsManager = new SecretsManager();
let cachedGoogleOAuthClientSecret: { clientId?: string; clientSecret?: string } | null = null;
const OAUTH_TOKENS_TABLE_NAME = getRequiredEnv('OAUTH_TOKENS_TABLE_NAME');
const GOOGLE_OAUTH_CLIENT_SECRET_ARN = getRequiredEnv('GOOGLE_OAUTH_CLIENT_SECRET_ARN');

export const getGoogleOAuthClient = async (cognitoUserId: string): Promise<OAuth2Client> => {
  const oauthToken = await ddbClient.get({
    TableName: OAUTH_TOKENS_TABLE_NAME,
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
      SecretId: GOOGLE_OAUTH_CLIENT_SECRET_ARN,
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
