import { DynamoDB } from 'aws-sdk';
import {
  putExperienceHandler,
  PutExperienceChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getExperienceIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const EXPERIENCES_TABLE_NAME = getRequiredEnv('EXPERIENCES_TABLE_NAME');

/**
 * Type-safe handler for the PutExperience operation
 */
export const putExperience: PutExperienceChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start PutExperience Operation');

  let experienceId: string;
  try {
    experienceId = await getExperienceIdFromEvent(request.event);
    logger.info(`Resolved experience ID from API key: ${experienceId}`);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to resolve experience from API key: ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to resolve experience from API key',
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
  const experienceNameRaw = body.experienceName;
  const robloxGameIdRaw = body.robloxGameId;
  const experienceName = experienceNameRaw.trim();
  const robloxGameId = robloxGameIdRaw.trim();

  const nowIso = new Date().toISOString();

  logger.info(
    `Upserting experience profile (experience=${experienceId}, robloxGameId=${robloxGameId})`,
  );

  try {
    await ddbClient
      .update({
        TableName: EXPERIENCES_TABLE_NAME,
        Key: {
          ExperienceId: experienceId,
        },
        UpdateExpression: [
          'SET #experienceName = :experienceName',
          '#robloxGameId = :robloxGameId',
          '#updatedAt = :updatedAt',
          '#createdAt = if_not_exists(#createdAt, :createdAt)',
        ].join(', '),
        ExpressionAttributeNames: {
          '#experienceName': 'ExperienceName',
          '#robloxGameId': 'RobloxGameId',
          '#updatedAt': 'UpdatedAt',
          '#createdAt': 'CreatedAt',
        },
        ExpressionAttributeValues: {
          ':experienceName': experienceName,
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
        `Failed to upsert experience profile (experience=${experienceId}): ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to save experience profile',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error while saving experience profile (experience=${experienceId}): ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to save experience profile',
    });
  }

  logger.info(
    `Successfully saved experience profile (experience=${experienceId}, robloxGameId=${robloxGameId})`,
  );

  return Response.success({
    message: 'Experience profile saved',
  });
};

/**
 * Entry point for the AWS Lambda handler for the PutExperience operation.
 * The putExperienceHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = putExperienceHandler(...INTERCEPTORS, putExperience);
