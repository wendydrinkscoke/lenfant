import { DynamoDB } from 'aws-sdk';
import {
  listAssetsHandler,
  ListAssetsChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  AssetRecord,
  AssetStatus,
  AssetContentType,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const ASSETS_BY_PROJECT_INDEX_NAME = 'CognitoUserIdExperienceIdIndex';

const SUPPORTED_ASSET_STATUSES = new Set<AssetStatus>([
  'uploading',
  'processing',
  'ready',
  'failed',
]);

const SUPPORTED_ASSET_CONTENT_TYPES = new Set<AssetContentType>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

type AssetDdbRecord = {
  AssetId?: string;
  ExperienceId?: string;
  FileName?: string;
  ContentType?: string;
  SizeBytes?: number;
  ObjectKey?: string;
  Status?: string;
  CreatedAt?: number;
  UpdatedAt?: number;
};

const parseAssetRecord = (
  item: AssetDdbRecord,
  expectedExperienceId: string,
): AssetRecord | null => {
  const assetId = item.AssetId?.trim();
  const experienceId = item.ExperienceId?.trim();
  const fileName = item.FileName?.trim();
  const contentType = item.ContentType?.trim() as AssetContentType | undefined;
  const sizeBytes = item.SizeBytes;
  const objectKey = item.ObjectKey?.trim();
  const status = item.Status?.trim() as AssetStatus | undefined;
  const createdAt = item.CreatedAt;
  const updatedAt = item.UpdatedAt;

  if (!assetId || !experienceId || experienceId !== expectedExperienceId || !fileName || !objectKey) {
    return null;
  }
  if (!contentType || !SUPPORTED_ASSET_CONTENT_TYPES.has(contentType)) {
    return null;
  }
  if (!status || !SUPPORTED_ASSET_STATUSES.has(status)) {
    return null;
  }
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return null;
  }
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return null;
  }
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
    return null;
  }

  return {
    assetId,
    experienceId,
    fileName,
    contentType,
    sizeBytes,
    objectKey,
    status,
    createdAt,
    updatedAt,
  };
};

/**
 * Type-safe handler for the ListAssets operation
 */
export const listAssets: ListAssetsChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start ListAssets Operation');

  let assetsTableName: string;
  try {
    assetsTableName = getRequiredEnv('ASSETS_TABLE_NAME');
  } catch (error) {
    logger.error((error as Error).message);
    return Response.internalFailure({
      message: 'Misconfigured lambda environment.',
    });
  }

  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
  } catch (error) {
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }

  const experienceId = request.input.requestParameters.experienceId?.trim();
  if (!experienceId) {
    return Response.badRequest({
      message: 'experienceId is required',
    });
  }

  const assets: AssetRecord[] = [];
  let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;

  try {
    do {
      const result = await ddbClient.query({
        TableName: assetsTableName,
        IndexName: ASSETS_BY_PROJECT_INDEX_NAME,
        KeyConditionExpression:
          '#cognitoUserId = :cognitoUserId AND #experienceId = :experienceId',
        ExpressionAttributeNames: {
          '#cognitoUserId': 'CognitoUserId',
          '#experienceId': 'ExperienceId',
        },
        ExpressionAttributeValues: {
          ':cognitoUserId': cognitoUserId,
          ':experienceId': experienceId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }).promise();

      ((result.Items ?? []) as AssetDdbRecord[]).forEach((item) => {
        const asset = parseAssetRecord(item, experienceId);
        if (asset) {
          assets.push(asset);
        }
      });

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to list assets for cognitoUserId=${cognitoUserId}, experienceId=${experienceId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error listing assets for cognitoUserId=${cognitoUserId}, experienceId=${experienceId}: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to list assets.',
    });
  }

  assets.sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    if (right.createdAt !== left.createdAt) {
      return right.createdAt - left.createdAt;
    }
    return left.assetId.localeCompare(right.assetId);
  });

  return Response.success({
    assets,
  });
};

/**
 * Entry point for the AWS Lambda handler for the ListAssets operation.
 * The listAssetsHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = listAssetsHandler(...INTERCEPTORS, listAssets);
