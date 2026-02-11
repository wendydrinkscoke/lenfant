import { DynamoDB } from 'aws-sdk';
import {
  putPartnerHandler,
  PutPartnerChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getPartnerIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const PARTNERS_TABLE_NAME = getRequiredEnv('PARTNERS_TABLE_NAME');

/**
 * Type-safe handler for the PutPartner operation
 */
export const putPartner: PutPartnerChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start PutPartner Operation');

  let partnerId: string;
  try {
    partnerId = await getPartnerIdFromEvent(request.event);
    logger.info(`Resolved partner ID from API key: ${partnerId}`);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to resolve partner from API key: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to resolve partner from API key',
        details: `DynamoDB error: ${error.code}`,
      });
    }
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Valid API key required',
    });
  }

  const { input } = request;
  const body = input.body;
  const partnerNameRaw = body.partnerName;
  const robloxGameIdRaw = body.robloxGameId;
  const partnerName = partnerNameRaw.trim();
  const robloxGameId = robloxGameIdRaw.trim();

  const nowIso = new Date().toISOString();

  logger.info(
    `Upserting partner profile (partner=${partnerId}, robloxGameId=${robloxGameId})`,
  );

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
