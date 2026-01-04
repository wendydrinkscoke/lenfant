import { DynamoDB } from 'aws-sdk';
import {
  putPartnerHandler,
  PutPartnerChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getApiKeyIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const PARTNERS_TABLE_NAME = getRequiredEnv('PARTNERS_TABLE_NAME');
const PARTNERS_V2_TABLE_NAME = getRequiredEnv('PARTNERS_V2_TABLE_NAME');
const PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME = getRequiredEnv(
  'PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME',
);

/**
 * Type-safe handler for the PutPartner operation
 */
export const putPartner: PutPartnerChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start PutPartner Operation');

  let partnerId: string;
  try {
    partnerId = getApiKeyIdFromEvent(request.event);
    logger.info(`Resolved partner ID from API key: ${partnerId}`);
  } catch (error) {
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Valid API key required',
    });
  }

  const { input } = request;
  const body = input.body as {
    partnerName: string;
    robloxGameId: string;
    experienceId?: string;
  };
  const partnerNameRaw = body.partnerName;
  const robloxGameIdRaw = body.robloxGameId;
  const experienceIdRaw =
    typeof body.experienceId === 'string' ? body.experienceId : undefined;
  const partnerName = partnerNameRaw.trim();
  const robloxGameId = robloxGameIdRaw.trim();
  let experienceId = experienceIdRaw?.trim();

  const nowIso = new Date().toISOString();

  logger.info(
    `Upserting partner profile (partner=${partnerId}, robloxGameId=${robloxGameId})`,
  );

  if (!experienceId) {
    try {
      const mappingResponse = await ddbClient
        .get({
          TableName: PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME,
          Key: {
            ApiKeyId: partnerId,
          },
          ConsistentRead: true,
        })
        .promise();
      const mappedExperienceId = (mappingResponse.Item as
        | { ExperienceId?: string }
        | undefined)?.ExperienceId;
      if (mappedExperienceId) {
        experienceId = mappedExperienceId.trim();
        logger.info(
          `Resolved experienceId ${experienceId} from API key mapping.`,
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to resolve experienceId mapping for partner ${partnerId}: ${JSON.stringify(error)}`,
      );
    }
  }

  try {
    await ddbClient
      .update({
        TableName: PARTNERS_TABLE_NAME,
        Key: {
          PartnerId: partnerId,
        },
        UpdateExpression: [
          'SET #partnerName = :partnerName',
          '#robloxGameId = :robloxGameId',
          '#updatedAt = :updatedAt',
          '#createdAt = if_not_exists(#createdAt, :createdAt)',
        ].join(', '),
        ExpressionAttributeNames: {
          '#partnerName': 'PartnerName',
          '#robloxGameId': 'RobloxGameId',
          '#updatedAt': 'UpdatedAt',
          '#createdAt': 'CreatedAt',
        },
        ExpressionAttributeValues: {
          ':partnerName': partnerName,
          ':robloxGameId': robloxGameId,
          ':updatedAt': nowIso,
          ':createdAt': nowIso,
        },
        ReturnValues: 'NONE',
      })
      .promise();

    if (experienceId) {
      await ddbClient
        .update({
          TableName: PARTNERS_V2_TABLE_NAME,
          Key: {
            ExperienceId: experienceId,
          },
          UpdateExpression: [
            'SET #partnerName = :partnerName',
            '#robloxGameId = :robloxGameId',
            '#partnerId = :partnerId',
            '#updatedAt = :updatedAt',
            '#createdAt = if_not_exists(#createdAt, :createdAt)',
          ].join(', '),
          ExpressionAttributeNames: {
            '#partnerName': 'PartnerName',
            '#robloxGameId': 'RobloxGameId',
            '#partnerId': 'PartnerId',
            '#updatedAt': 'UpdatedAt',
            '#createdAt': 'CreatedAt',
          },
          ExpressionAttributeValues: {
            ':partnerName': partnerName,
            ':robloxGameId': robloxGameId,
            ':partnerId': partnerId,
            ':updatedAt': nowIso,
            ':createdAt': nowIso,
          },
          ReturnValues: 'NONE',
        })
        .promise();
    } else {
      logger.info(
        `Skipping PartnersV2 write; missing experienceId for partner ${partnerId}.`,
      );
    }
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to upsert partner profile (partner=${partnerId}): ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to save partner profile',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error while saving partner profile (partner=${partnerId}): ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to save partner profile',
    });
  }

  logger.info(
    `Successfully saved partner profile (partner=${partnerId}, robloxGameId=${robloxGameId})`,
  );

  return Response.success({
    message: 'Partner profile saved',
  });
};

/**
 * Entry point for the AWS Lambda handler for the PutPartner operation.
 * The putPartnerHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = putPartnerHandler(...INTERCEPTORS, putPartner);
