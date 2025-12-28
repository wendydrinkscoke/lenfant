import { DynamoDB } from 'aws-sdk';
import {
  catalogTaskHandler,
  CatalogTaskChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getExperienceIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');

/**
 * Type-safe handler for the CatalogTask operation
 */
export const catalogTask: CatalogTaskChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CatalogTask Operation');

  let experienceId: string;
  try {
    experienceId = await getExperienceIdFromEvent(request.event);
    logger.info(`Resolved experience ID from API key: ${experienceId}`);
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

  const { milestones } = input.body;
  if (milestones) {
    const seenIds = new Set<string>();
    for (const { id } of milestones) {
      if (seenIds.has(id)) {
        return Response.badRequest({
          message: `Duplicate identifier ${id}`,
        });
      }
      seenIds.add(id);
    }

    const totalPercentage = milestones.reduce(
      (total, milestone) => total + milestone.percentageContribution,
      0,
    );

    if (totalPercentage !== 100) {
      return Response.badRequest({
        message: 'The sum of percentages awarded across all milestones must equal 100',
      });
    }

    if (milestones.length == 0) {
      return Response.badRequest({
        message: 'Milestones array must not be empty if provided',
      });
    }
  }

  const nowIso = new Date().toISOString();
  const sanitizedName = name.trim();
  const sanitizedSubheading = subheading.trim();
  const sanitizedInstructions = instructions.trim();

  logger.info(
    `Upserting catalog entry (experienceId=${experienceId}, entryId=${entryId})`,
  );

  const updateSegments = [
    '#name = :name',
    '#subheading = :subheading',
    '#instructions = :instructions',
    '#updatedAt = :updatedAt',
    '#createdAt = if_not_exists(#createdAt, :createdAt)',
  ];

  const expressionAttributeNames: Record<string, string> = {
    '#name': 'Name',
    '#subheading': 'Subheading',
    '#instructions': 'Instructions',
    '#updatedAt': 'UpdatedAt',
    '#createdAt': 'CreatedAt',
  };

  const expressionAttributeValues: Record<string, unknown> = {
    ':name': sanitizedName,
    ':subheading': sanitizedSubheading,
    ':instructions': sanitizedInstructions,
    ':updatedAt': nowIso,
    ':createdAt': nowIso,
  };

  if (milestones) {
    updateSegments.push('#milestones = :milestones');
    expressionAttributeNames['#milestones'] = 'Milestones';
    expressionAttributeValues[':milestones'] = milestones;
  }

  const updateExpression = `SET ${updateSegments.join(', ')}`;

  try {
    await ddbClient.update({
      TableName: TASK_CATALOG_TABLE_NAME,
      Key: {
        ExperienceId: experienceId,
        EntryId: entryId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE',
    }).promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to upsert catalog entry (experienceId=${experienceId}, entryId=${entryId}): ${error.code} - ${error.message}`,
      );
      return Response.internalFailure({
        message: 'Failed to save catalog entry',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(
      `Unexpected error while upserting catalog entry (experienceId=${experienceId}, entryId=${entryId}): ${JSON.stringify(error)}`,
    );
    return Response.internalFailure({
      message: 'Failed to save catalog entry',
    });
  }

  logger.info(
    `Successfully cataloged task entry (experienceId=${experienceId}, entryId=${entryId})`,
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
