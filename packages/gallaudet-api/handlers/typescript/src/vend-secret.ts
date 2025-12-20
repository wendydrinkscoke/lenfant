import { randomBytes } from 'crypto';
import { DynamoDB, APIGateway, SecretsManager } from 'aws-sdk';
import {
  vendSecretHandler,
  VendSecretChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  MissingRequiredRobloxOAuthScopesResponseContent,
  SecretAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { request as gaxiosRequest } from 'gaxios';
import { sealedbox } from 'tweetnacl-ts';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-ts/convert';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const apiGateway = new APIGateway();
const secretsManager = new SecretsManager();

const generateSecretId = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(12);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
};

const cleanupApiKey = async (
  apiKeyId: string,
  usagePlanId: string,
  logger: ReturnType<typeof LoggingInterceptor.getLogger>,
) => {
  try {
    if (usagePlanId) {
      await apiGateway.deleteUsagePlanKey({
        usagePlanId,
        keyId: apiKeyId,
      }).promise();
    }
  } catch (err) {
    logger.warn(`Failed to remove API key ${apiKeyId} from usage plan ${usagePlanId}: ${JSON.stringify(err)}`);
  }

  try {
    await apiGateway.deleteApiKey({
      apiKey: apiKeyId,
    }).promise();
  } catch (err) {
    logger.warn(`Failed to delete API key ${apiKeyId}: ${JSON.stringify(err)}`);
  }
};

const resolveUsagePlanId = async (
  usagePlanName: string,
  logger: ReturnType<typeof LoggingInterceptor.getLogger>,
): Promise<string> => {
  let position: string | undefined;
  do {
    const resp = await apiGateway.getUsagePlans({ position }).promise();
    const match = resp.items?.find((plan) => plan.name === usagePlanName);
    if (match?.id) {
      logger.info(`Resolved usage plan id ${match.id} for ${usagePlanName}`);
      return match.id;
    }
    position = resp.position;
  } while (position);

  throw new Error(`Usage plan not found for name ${usagePlanName}`);
};

const refreshRobloxAccessToken = async (
  refreshToken: string,
  logger: ReturnType<typeof LoggingInterceptor.getLogger>,
): Promise<string | undefined> => {
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  try {
    const robloxSecretArn = getRequiredEnv('ROBLOX_OAUTH_CLIENT_SECRET_ARN');
    const secretValue = await secretsManager.getSecretValue({ SecretId: robloxSecretArn }).promise();
    if (!secretValue.SecretString) {
      throw new Error('SecretString was empty for Roblox OAuth secret');
    }
    ({ clientId, clientSecret } = JSON.parse(secretValue.SecretString));
  } catch (err) {
    logger.error(`Failed to retrieve Roblox OAuth client credentials: ${JSON.stringify(err)}`);
    return undefined;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
    });

    const resp = await gaxiosRequest<{
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

    const access = resp.data.access_token;
    if (access) {
      logger.info('Refreshed Roblox access token via refresh_token grant');
      return access;
    }
    logger.warn('Roblox token refresh response missing access_token');
    return undefined;
  } catch (err) {
    logger.error(`Roblox token refresh failed: ${JSON.stringify(err)}`);
    return undefined;
  }
};

/**
 * Type-safe handler for the VendSecret operation
 */
export const vendSecret: VendSecretChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start VendSecret Operation');

  const { input } = request;
  const { experienceId } = input.requestParameters;

  let oauthTokensTableName: string;
  let usagePlanName: string;
  let secretDomain: string;
  try {
    oauthTokensTableName = getRequiredEnv('OAUTH_TOKENS_TABLE_NAME');
    usagePlanName = getRequiredEnv('PARTNER_API_KEY_USAGE_PLAN_NAME');
    secretDomain = getRequiredEnv('SECRET_DOMAIN');
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
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const tokenResponse = await ddbClient.get({
      TableName: oauthTokensTableName,
      Key: {
        CognitoUserId: cognitoUserId,
        Provider: 'roblox',
      },
      ConsistentRead: true,
    }).promise();
    const tokenItem = tokenResponse.Item as { AccessToken?: string; RefreshToken?: string } | undefined;
    accessToken = tokenItem?.AccessToken;
    refreshToken = tokenItem?.RefreshToken;
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(`Failed to read OAuth token from DynamoDB: ${ddbError.code} - ${ddbError.message}`);
    } else {
      logger.error(`Unexpected error reading OAuth token: ${JSON.stringify(ddbError)}`);
    }
    return Response.internalFailure({
      message: 'Failed to retrieve Roblox OAuth token',
    });
  }

  if (!accessToken) {
    return Response.notAuthorized({
      message: 'Roblox OAuth scopes have not been delegated for this user.',
    } as MissingRequiredRobloxOAuthScopesResponseContent);
  }

  const publicKeyEndpoint =
    `https://apis.roblox.com/cloud/v2/universes/${experienceId}/secrets/public-key`;

  let publicKey: string | undefined;
  let keyId: string | undefined;
  const fetchPublicKey = async (token: string): Promise<globalThis.Response> => fetch(publicKeyEndpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const parseBody = async (resp: globalThis.Response) => {
    const text = await resp.text();
    try {
      return { text, json: JSON.parse(text) as any };
    } catch {
      return { text, json: undefined };
    }
  };

  const shouldRefreshForResponse = async (resp: globalThis.Response) => {
    if (!refreshToken) return false;
    if (resp.status === 401 || resp.status === 403) return true;
    const { text } = await parseBody(resp.clone());
    return text.toLowerCase().includes('invalid token');
  };

  let publicKeyResponse = await fetchPublicKey(accessToken);
  if (!publicKeyResponse.ok && (await shouldRefreshForResponse(publicKeyResponse))) {
    const refreshed = await refreshRobloxAccessToken(refreshToken!, logger);
    if (refreshed) {
      try {
        await ddbClient.update({
          TableName: oauthTokensTableName,
          Key: { CognitoUserId: cognitoUserId, Provider: 'roblox' },
          UpdateExpression: 'SET #A = :a',
          ExpressionAttributeNames: { '#A': 'AccessToken' },
          ExpressionAttributeValues: { ':a': refreshed },
        }).promise();
      } catch (err) {
        logger.warn(`Failed to persist refreshed Roblox access token: ${JSON.stringify(err)}`);
      }
      accessToken = refreshed;
      publicKeyResponse = await fetchPublicKey(refreshed);
    }
  }

  try {
    const { json: publicKeyBody, text: bodyText } = await parseBody(publicKeyResponse);
    logger.info(`Public key API call response: ${bodyText}.`);
    if (publicKeyResponse.status === 403) {
      return Response.notAuthorized({
        message: 'Roblox OAuth scopes have not been delegated for this user.',
      } as MissingRequiredRobloxOAuthScopesResponseContent);
    }

    if (!publicKeyResponse.ok) {
      logger.error(`Failed to fetch Roblox public key: ${publicKeyResponse.status} ${bodyText}`);
      if (400 <= publicKeyResponse.status && publicKeyResponse.status < 500) {
        return Response.notAuthorized({
          message: 'Roblox OAuth scopes have not been delegated for this user.',
        });
      }
      return Response.internalFailure({
        message: 'Failed to fetch Roblox public key.',
      });
    }

    publicKey = publicKeyBody.secret;
    keyId = publicKeyBody.key_id ?? publicKeyBody.keyId;
  } catch (err) {
    logger.error(`Error while fetching Roblox public key: ${(err as Error).message}`);
    return Response.internalFailure({
      message: 'Failed to fetch Roblox public key.',
    });
  }

  if (!publicKey || !keyId) {
    logger.error('Roblox public key response missing expected fields.');
    return Response.internalFailure({
      message: 'Failed to parse Roblox public key response.',
    });
  }

  let apiKeyId: string | undefined;
  let apiKeyValue: string | undefined;
  try {
    const createKeyResponse = await apiGateway.createApiKey({
      name: `partner-${experienceId}-${Date.now()}`,
      description: `Partner API key for experience ${experienceId}`,
      enabled: true,
      generateDistinctId: true,
    }).promise();
    apiKeyId = createKeyResponse.id;
    apiKeyValue = createKeyResponse.value;
    logger.info(`Created API Gateway key ${apiKeyId} for experience ${experienceId}`);
  } catch (apiError) {
    if (isAWSError(apiError)) {
      logger.error(`Failed to create API key: ${apiError.code} - ${apiError.message}`);
    } else {
      logger.error(`Unexpected error creating API key: ${JSON.stringify(apiError)}`);
    }
    return Response.internalFailure({
      message: 'Failed to create API key for partner experience.',
    });
  }

  if (!apiKeyId || !apiKeyValue) {
    logger.error('API Gateway did not return an id/value for the new API key.');
    return Response.internalFailure({
      message: 'Failed to create API key for partner experience.',
    });
  }

  let usagePlanId: string;
  try {
    usagePlanId = await resolveUsagePlanId(usagePlanName, logger);
  } catch (err) {
    logger.error((err as Error).message);
    await cleanupApiKey(apiKeyId, '', logger);
    return Response.internalFailure({
      message: 'Failed to resolve usage plan for partner API keys.',
    });
  }

  try {
    await apiGateway.createUsagePlanKey({
      keyId: apiKeyId,
      keyType: 'API_KEY',
      usagePlanId,
    }).promise();
    logger.info(`Attached API key ${apiKeyId} to usage plan ${usagePlanId}`);
  } catch (apiError) {
    if (isAWSError(apiError)) {
      logger.error(`Failed to attach API key to usage plan: ${apiError.code} - ${apiError.message}`);
    } else {
      logger.error(`Unexpected error attaching API key to usage plan: ${JSON.stringify(apiError)}`);
    }
    await cleanupApiKey(apiKeyId, usagePlanId, logger);
    return Response.internalFailure({
      message: 'Failed to attach API key to usage plan.',
    });
  }

  let encryptedSecret: string;
  try {
    const sealed = sealedbox(decodeUTF8(apiKeyValue), decodeBase64(publicKey));
    encryptedSecret = encodeBase64(sealed);
  } catch (err) {
    logger.error(`Failed to encrypt API key for Roblox secret store: ${(err as Error).message}`);
    await cleanupApiKey(apiKeyId, usagePlanId, logger);
    return Response.internalFailure({
      message: 'Failed to encrypt API key for Roblox secret store.',
    });
  }

  const secretId = generateSecretId();
  logger.info(`Generated secretId ${secretId} for experience ${experienceId}`);

  const secretEndpoint =
    `https://apis.roblox.com/cloud/v2/universes/${experienceId}/secrets`;
  try {
    const secretResponse = await fetch(secretEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: secretId,
        secret: encryptedSecret,
        key_id: keyId,
        domain: secretDomain,
      }),
    });

    const json = await secretResponse.json();
    logger.info(`Roblox secret store POST response: ${JSON.stringify(json)}`);

    if (secretResponse.status === 403) {
      await cleanupApiKey(apiKeyId, usagePlanId, logger);
      return Response.notAuthorized({
        message: 'Roblox OAuth scopes have not been delegated for this user.',
      } as MissingRequiredRobloxOAuthScopesResponseContent);
    }

    if (secretResponse.status === 409) {
      await cleanupApiKey(apiKeyId, usagePlanId, logger);
      return {
        statusCode: 409,
        body: {
          message: 'Secret already exists for the specified experience and domain.',
        } as SecretAlreadyExistsErrorResponseContent,
      };
    }

    if (!secretResponse.ok) {
      const errorBody = await secretResponse.text();
      logger.error(`Failed to store secret in Roblox: ${secretResponse.status} - ${errorBody}`);
      await cleanupApiKey(apiKeyId, usagePlanId, logger);
      return Response.internalFailure({
        message: 'Failed to store secret in Roblox.',
      });
    }
  } catch (err) {
    logger.error(`Error while storing Roblox secret: ${(err as Error).message}`);
    await cleanupApiKey(apiKeyId, usagePlanId, logger);
    return Response.internalFailure({
      message: 'Failed to store secret in Roblox.',
    });
  }

  return Response.success({
    secretId,
  });
};

/**
 * Entry point for the AWS Lambda handler for the VendSecret operation.
 * The vendSecretHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = vendSecretHandler(...INTERCEPTORS, vendSecret);
