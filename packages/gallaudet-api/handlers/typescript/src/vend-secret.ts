import { randomBytes } from 'crypto';
import { DynamoDB, APIGateway } from 'aws-sdk';
import {
  vendSecretHandler,
  VendSecretChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  MissingRequiredRobloxOAuthScopesResponseContent,
  SecretAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { sealedbox } from 'tweetnacl-ts';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-ts/convert';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const apiGateway = new APIGateway();

const PARTNER_API_KEYS_EXPERIENCE_GSI_NAME = 'ExperienceIdIndex';
const PARTNER_KEY_ROTATION_WINDOW_SECONDS = 3 * 60 * 60;

type PartnerApiKeyRecord = {
  ApiKeyId?: string;
  ExperienceId?: string;
  CreatedAt?: string;
  ExpiresAt?: number;
  SecretId?: string;
  Status?: string;
};

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

const selectActivePartnerApiKey = (
  items: PartnerApiKeyRecord[],
): PartnerApiKeyRecord | undefined => {
  const now = Math.floor(Date.now() / 1000);
  const activeKeys = items
    .filter((item) => !!item.ApiKeyId)
    .filter((item) => !item.ExpiresAt || item.ExpiresAt > now)
    .filter((item) => !item.Status || item.Status === 'Active')
    .sort((a, b) => {
      const aTime = a.CreatedAt ? Date.parse(a.CreatedAt) : 0;
      const bTime = b.CreatedAt ? Date.parse(b.CreatedAt) : 0;
      return bTime - aTime;
    });
  return activeKeys[0];
};

/**
 * Type-safe handler for the VendSecret operation
 */
export const vendSecret: VendSecretChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start VendSecret Operation');

  const { input } = request;
  const { experienceId } = input.requestParameters;

  let apiKeysTableName: string;
  let partnerApiKeysTableName: string;
  let usagePlanName: string;
  let secretDomain: string;
  try {
    apiKeysTableName = getRequiredEnv('ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME');
    partnerApiKeysTableName = getRequiredEnv('PARTNER_API_KEYS_TABLE_NAME');
    usagePlanName = getRequiredEnv('PARTNER_API_KEY_USAGE_PLAN_NAME');
    secretDomain = getRequiredEnv('SECRET_DOMAIN');
  } catch (err) {
    logger.error((err as Error).message);
    return Response.internalFailure({
      message: 'Configuration error',
    });
  }

  try {
    getCognitoUserIdFromEvent(request.event);
  } catch (err) {
    logger.warn((err as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }

  let experienceApiKey: string | undefined;
  try {
    const tokenResponse = await ddbClient.get({
      TableName: apiKeysTableName,
      Key: {
        ExperienceId: experienceId,
      },
      ConsistentRead: true,
    }).promise();
    const item = tokenResponse.Item as { ApiKey?: string } | undefined;
    experienceApiKey = item?.ApiKey;
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(`Failed to read Roblox API key from DynamoDB: ${ddbError.code} - ${ddbError.message}`);
    } else {
      logger.error(`Unexpected error reading Roblox API key: ${JSON.stringify(ddbError)}`);
    }
    return Response.internalFailure({
      message: 'Failed to retrieve Roblox API key',
    });
  }

  if (!experienceApiKey) {
    return Response.notAuthorized({
      message: 'Roblox secret store access has not been delegated for this experience.',
    } as MissingRequiredRobloxOAuthScopesResponseContent);
  }

  let previousKey: PartnerApiKeyRecord | undefined;
  try {
    const existingKeysResponse = await ddbClient.query({
      TableName: partnerApiKeysTableName,
      IndexName: PARTNER_API_KEYS_EXPERIENCE_GSI_NAME,
      KeyConditionExpression: '#experienceId = :experienceId',
      ExpressionAttributeNames: {
        '#experienceId': 'ExperienceId',
      },
      ExpressionAttributeValues: {
        ':experienceId': experienceId,
      },
      ConsistentRead: false,
    }).promise();
    const existingItems = (existingKeysResponse.Items as PartnerApiKeyRecord[] | undefined) ?? [];
    previousKey = selectActivePartnerApiKey(existingItems);
    if (previousKey?.ApiKeyId) {
      logger.info(`Found active API key ${previousKey.ApiKeyId} for experience ${experienceId}`);
    }
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(`Failed to query partner API keys: ${ddbError.code} - ${ddbError.message}`);
    } else {
      logger.error(`Unexpected error querying partner API keys: ${JSON.stringify(ddbError)}`);
    }
    return Response.internalFailure({
      message: 'Failed to resolve existing API keys',
    });
  }

  const publicKeyEndpoint =
    `https://apis.roblox.com/cloud/v2/universes/${experienceId}/secrets/public-key`;

  let publicKey: string | undefined;
  let keyId: string | undefined;
  const publicKeyResponse = await fetch(publicKeyEndpoint, {
    headers: {
      'x-api-key': experienceApiKey,
    },
  });

  try {
    const bodyText = await publicKeyResponse.text();
    logger.info(`Public key API call response: ${bodyText}.`);

    if (publicKeyResponse.status === 403) {
      return Response.notAuthorized({
        message: 'Roblox secret store access has not been delegated for this user.',
      } as MissingRequiredRobloxOAuthScopesResponseContent);
    }

    if (!publicKeyResponse.ok) {
      logger.error(`Failed to fetch Roblox public key: ${publicKeyResponse.status} ${bodyText}`);
      if (400 <= publicKeyResponse.status && publicKeyResponse.status < 500) {
        return Response.notAuthorized({
          message: 'Roblox secret store access has not been delegated for this user.',
        });
      }
      return Response.internalFailure({
        message: 'Failed to fetch Roblox public key.',
      });
    }

    const publicKeyBody = JSON.parse(bodyText);
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
        'x-api-key': experienceApiKey,
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
        message: 'Roblox secret store access has not been delegated for this user.',
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

  const nowIso = new Date().toISOString();
  try {
    await ddbClient.put({
      TableName: partnerApiKeysTableName,
      Item: {
        ApiKeyId: apiKeyId,
        ExperienceId: experienceId,
        SecretId: secretId,
        CreatedAt: nowIso,
        Status: 'Active',
      },
      ConditionExpression: 'attribute_not_exists(ApiKeyId)',
    }).promise();
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(`Failed to store partner API key mapping: ${ddbError.code} - ${ddbError.message}`);
    } else {
      logger.error(`Unexpected error storing partner API key mapping: ${JSON.stringify(ddbError)}`);
    }
    await cleanupApiKey(apiKeyId, usagePlanId, logger);
    return Response.internalFailure({
      message: 'Failed to store partner API key mapping.',
    });
  }

  let previousSecretId: string | undefined;
  let expiresAtIso: string | undefined;
  if (previousKey?.ApiKeyId) {
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + PARTNER_KEY_ROTATION_WINDOW_SECONDS;
    try {
      await ddbClient.update({
        TableName: partnerApiKeysTableName,
        Key: {
          ApiKeyId: previousKey.ApiKeyId,
        },
        UpdateExpression: 'SET #status = :status, #expiresAt = :expiresAt',
        ExpressionAttributeNames: {
          '#status': 'Status',
          '#expiresAt': 'ExpiresAt',
        },
        ExpressionAttributeValues: {
          ':status': 'Expiring',
          ':expiresAt': expiresAtSeconds,
        },
      }).promise();
      previousSecretId = previousKey.SecretId;
      expiresAtIso = new Date(expiresAtSeconds * 1000).toISOString();
    } catch (ddbError) {
      if (isAWSError(ddbError)) {
        logger.error(
          `Failed to mark previous API key ${previousKey.ApiKeyId} as expiring: ${ddbError.code} - ${ddbError.message}`,
        );
      } else {
        logger.error(
          `Unexpected error marking previous API key as expiring: ${JSON.stringify(ddbError)}`,
        );
      }
    }
  }

  return Response.success({
    secretId,
    ...(expiresAtIso ? { expiresAt: expiresAtIso } : {}),
    ...(previousSecretId ? { previousSecretId } : {}),
  });
};

/**
 * Entry point for the AWS Lambda handler for the VendSecret operation.
 * The vendSecretHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = vendSecretHandler(...INTERCEPTORS, vendSecret);
