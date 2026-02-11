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

/**
 * Type-safe handler for the VendSecret operation
 */
export const vendSecret: VendSecretChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start VendSecret Operation');

  const { input } = request;
  const { experienceId } = input.requestParameters;

  let apiKeysTableName: string;
  let gallaudetApiKeysTableName: string;
  let usagePlanName: string;
  let secretDomain: string;
  try {
    apiKeysTableName = getRequiredEnv('ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME');
    gallaudetApiKeysTableName = getRequiredEnv('GALLAUDET_API_KEYS_TABLE_NAME');
    usagePlanName = getRequiredEnv('EXPERIENCE_API_KEY_USAGE_PLAN_NAME');
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

  let experienceApiKey: string | undefined;
  try {
    const tokenResponse = await ddbClient.get({
      TableName: apiKeysTableName,
      Key: {
        CognitoUserId: cognitoUserId,
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
      name: `experience-${experienceId}-${Date.now()}`,
      description: `Experience API key for experience ${experienceId}`,
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
      message: 'Failed to create API key for experience.',
    });
  }

  if (!apiKeyId || !apiKeyValue) {
    logger.error('API Gateway did not return an id/value for the new API key.');
    return Response.internalFailure({
      message: 'Failed to create API key for experience.',
    });
  }

  let usagePlanId: string;
  try {
    usagePlanId = await resolveUsagePlanId(usagePlanName, logger);
  } catch (err) {
    logger.error((err as Error).message);
    await cleanupApiKey(apiKeyId, '', logger);
    return Response.internalFailure({
      message: 'Failed to resolve usage plan for experience API keys.',
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

  try {
    const nowIso = new Date().toISOString();
    await ddbClient.put({
      TableName: gallaudetApiKeysTableName,
      Item: {
        ApiGatewayKeyId: apiKeyId,
        ExperienceId: experienceId,
        RobloxSecretId: secretId,
        CreatedAt: nowIso,
        UpdatedAt: nowIso,
      },
    }).promise();
    logger.info(
      `Persisted API key mapping for apiKeyId=${apiKeyId}, experienceId=${experienceId}, secretId=${secretId}`,
    );
  } catch (ddbError) {
    if (isAWSError(ddbError)) {
      logger.error(`Failed to persist API key mapping: ${ddbError.code} - ${ddbError.message}`);
    } else {
      logger.error(`Unexpected error persisting API key mapping: ${JSON.stringify(ddbError)}`);
    }
    await cleanupApiKey(apiKeyId, usagePlanId, logger);
    return Response.internalFailure({
      message: 'Failed to persist experience API key mapping.',
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
