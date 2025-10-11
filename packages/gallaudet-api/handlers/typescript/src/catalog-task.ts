import { DynamoDB } from 'aws-sdk';
import {
  catalogTaskHandler,
  CatalogTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getApiKeyIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');

const SUPPORTED_GRADING_METHODS = new Set(['simple-completion']);

/**
 * Type-safe handler for the CatalogTask operation
 */
export const catalogTask: CatalogTaskChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CatalogTask Operation');

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
  const entryId = input.requestParameters?.entryId?.trim();

  if (!entryId) {
    logger.warn('Missing entryId path parameter');
    return Response.badRequest({
      message: 'entryId path parameter is required',
    });
  }

  if (!input.body) {
    logger.warn(`CatalogTask called without request body (entryId=${entryId})`);
    return Response.badRequest({
      message: 'Request body is required',
    });
  }

  const {
    name,
    subheading,
    instructions,
    gradingMethod,
  } = input.body;

  if (!name?.trim()) {
    logger.warn(`Missing name for entryId=${entryId}`);
    return Response.badRequest({
      message: 'name is required',
    });
  }

  if (!subheading?.trim()) {
    logger.warn(`Missing subheading for entryId=${entryId}`);
    return Response.badRequest({
      message: 'subheading is required',
    });
  }

  if (!instructions?.trim()) {
    logger.warn(`Missing instructions for entryId=${entryId}`);
    return Response.badRequest({
      message: 'instructions are required',
    });
  }

  if (!gradingMethod || !SUPPORTED_GRADING_METHODS.has(gradingMethod)) {
    logger.warn(
      `Unsupported grading method "${gradingMethod}" for partner ${partnerId} and entry ${entryId}`,
    );
    return Response.badRequest({
      message: 'Unsupported grading method',
    });
  }

  const nowIso = new Date().toISOString();
  const sanitizedName = name.trim();
  const sanitizedSubheading = subheading.trim();
  const sanitizedInstructions = instructions.trim();

  logger.info(
    `Upserting catalog entry (partner=${partnerId}, entryId=${entryId}, gradingMethod=${gradingMethod})`,
  );

  try {
    await ddbClient.update({
      TableName: TASK_CATALOG_TABLE_NAME,
      Key: {
        PartnerId: partnerId,
        EntryId: entryId,
      },
      UpdateExpression: [
        'SET #name = :name',
        '#subheading = :subheading',
        '#instructions = :instructions',
        '#gradingMethod = :gradingMethod',
        '#updatedAt = :updatedAt',
        '#createdAt = if_not_exists(#createdAt, :createdAt)',
      ].join(', '),
      ExpressionAttributeNames: {
        '#name': 'Name',
        '#subheading': 'Subheading',
        '#instructions': 'Instructions',
        '#gradingMethod': 'GradingMethod',
        '#updatedAt': 'UpdatedAt',
        '#createdAt': 'CreatedAt',
      },
      ExpressionAttributeValues: {
        ':name': sanitizedName,
        ':subheading': sanitizedSubheading,
        ':instructions': sanitizedInstructions,
        ':gradingMethod': gradingMethod,
        ':updatedAt': nowIso,
        ':createdAt': nowIso,
      },
      ReturnValues: 'NONE',
    }).promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to upsert catalog entry (partner=${partnerId}, entryId=${entryId}): ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to save catalog entry',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error while upserting catalog entry (partner=${partnerId}, entryId=${entryId}): ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to save catalog entry',
    });
  }

  logger.info(
    `Successfully cataloged task entry (partner=${partnerId}, entryId=${entryId})`,
  );

  return Response.success({
    message: 'Task catalog entry saved',
  });
};

/**
 * Entry point for the AWS Lambda handler for the CatalogTask operation.
 * The catalogTaskHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = catalogTaskHandler(...INTERCEPTORS, catalogTask);
