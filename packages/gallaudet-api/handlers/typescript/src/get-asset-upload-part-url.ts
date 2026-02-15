import { DynamoDB, S3 } from 'aws-sdk';
import {
  getAssetUploadPartUrlHandler,
  GetAssetUploadPartUrlChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const s3Client = new S3({ signatureVersion: 'v4' });

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 900;

type UploadSessionRecord = {
  UploadSessionId?: string;
  AssetId?: string;
  CognitoUserId?: string;
  ExperienceId?: string;
  ObjectKey?: string;
  Strategy?: string;
  MultipartUploadId?: string;
  MultipartPartCount?: number;
};

const getOptionalPositiveIntEnv = (key: string, fallback: number): number => {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

/**
 * Type-safe handler for the GetAssetUploadPartUrl operation
 */
export const getAssetUploadPartUrl: GetAssetUploadPartUrlChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetAssetUploadPartUrl Operation');

  let assetsBucketName: string;
  let uploadsTableName: string;
  try {
    assetsBucketName = getRequiredEnv('ASSETS_BUCKET_NAME');
    uploadsTableName = getRequiredEnv('ASSET_UPLOADS_TABLE_NAME');
  } catch (error) {
    logger.error((error as Error).message);
    return Response.internalFailure({
      message: 'Misconfigured lambda environment.',
    });
  }

  const uploadUrlTtlSeconds = getOptionalPositiveIntEnv(
    'ASSET_UPLOAD_URL_TTL_SECONDS',
    DEFAULT_UPLOAD_URL_TTL_SECONDS,
  );

  let cognitoUserId: string;
  try {
    cognitoUserId = getCognitoUserIdFromEvent(request.event);
  } catch (error) {
    logger.warn((error as Error).message);
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }

  const { experienceId, uploadSessionId, partNumber } = request.input.requestParameters;

  if (!experienceId?.trim()) {
    return Response.badRequest({
      message: 'experienceId is required',
    });
  }
  if (!uploadSessionId?.trim()) {
    return Response.badRequest({
      message: 'uploadSessionId is required',
    });
  }
  if (!Number.isInteger(partNumber) || partNumber <= 0) {
    return Response.badRequest({
      message: 'partNumber must be a positive integer',
    });
  }

  let session: UploadSessionRecord | undefined;
  try {
    const sessionResult = await ddbClient.get({
      TableName: uploadsTableName,
      Key: {
        UploadSessionId: uploadSessionId,
      },
      ConsistentRead: true,
    }).promise();
    session = sessionResult.Item as UploadSessionRecord | undefined;
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to load upload session ${uploadSessionId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error loading upload session ${uploadSessionId}: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to load upload session.',
    });
  }

  if (!session) {
    return Response.notFound({
      message: 'Upload session not found.',
    });
  }

  if (session.CognitoUserId !== cognitoUserId || session.ExperienceId !== experienceId) {
    return Response.notAuthorized({
      message: 'You are not authorized to access this upload session.',
    });
  }

  if (session.Strategy !== 'multipart-put') {
    return Response.badRequest({
      message: 'This upload session does not use multipart uploads.',
    });
  }

  if (!session.MultipartUploadId || !session.ObjectKey) {
    return Response.internalFailure({
      message: 'Upload session is missing multipart metadata.',
    });
  }

  if (
    typeof session.MultipartPartCount === 'number' &&
    Number.isFinite(session.MultipartPartCount) &&
    partNumber > session.MultipartPartCount
  ) {
    return Response.badRequest({
      message: 'partNumber exceeds multipart part count.',
    });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + uploadUrlTtlSeconds;
  try {
    const uploadUrl = await s3Client.getSignedUrlPromise('uploadPart', {
      Bucket: assetsBucketName,
      Key: session.ObjectKey,
      UploadId: session.MultipartUploadId,
      PartNumber: partNumber,
      Expires: uploadUrlTtlSeconds,
    });

    return Response.success({
      uploadUrl,
      expiresAt,
    });
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to issue multipart part URL for uploadSessionId=${uploadSessionId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error issuing multipart part URL: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to generate upload URL.',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the GetAssetUploadPartUrl operation.
 * The getAssetUploadPartUrlHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getAssetUploadPartUrlHandler(...INTERCEPTORS, getAssetUploadPartUrl);
