import { randomUUID } from 'crypto';
import { DynamoDB, S3 } from 'aws-sdk';
import {
  startAssetUploadHandler,
  StartAssetUploadChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  UploadStrategy,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const s3Client = new S3({ signatureVersion: 'v4' });

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 900;
const DEFAULT_MULTIPART_THRESHOLD_BYTES = 10 * 1024 * 1024;
const DEFAULT_MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;
const MIN_MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_CONTENT_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

type ProjectRecord = {
  CognitoUserId?: string;
  ExperienceId?: string;
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

const sanitizeFileName = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'asset';
  }
  return trimmed.replace(/[^A-Za-z0-9._-]/g, '_');
};

const sanitizePathSegment = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'unknown';
  }
  return trimmed.replace(/[^A-Za-z0-9._-]/g, '_');
};

/**
 * Type-safe handler for the StartAssetUpload operation
 */
export const startAssetUpload: StartAssetUploadChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start StartAssetUpload Operation');

  let assetsBucketName: string;
  let uploadsTableName: string;
  let assetsTableName: string;
  let projectsTableName: string;
  try {
    assetsBucketName = getRequiredEnv('ASSETS_BUCKET_NAME');
    uploadsTableName = getRequiredEnv('ASSET_UPLOADS_TABLE_NAME');
    assetsTableName = getRequiredEnv('ASSETS_TABLE_NAME');
    projectsTableName = getRequiredEnv('PROJECTS_TABLE_NAME');
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
  const multipartThresholdBytes = getOptionalPositiveIntEnv(
    'ASSET_MULTIPART_THRESHOLD_BYTES',
    DEFAULT_MULTIPART_THRESHOLD_BYTES,
  );
  const configuredPartSizeBytes = getOptionalPositiveIntEnv(
    'ASSET_MULTIPART_PART_SIZE_BYTES',
    DEFAULT_MULTIPART_PART_SIZE_BYTES,
  );
  const multipartPartSizeBytes = Math.max(
    configuredPartSizeBytes,
    MIN_MULTIPART_PART_SIZE_BYTES,
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

  const { experienceId } = request.input.requestParameters;
  const body = request.input.body;
  const fileName = body?.fileName?.trim();
  const contentType = body?.contentType;
  const contentLengthBytes = body?.contentLengthBytes;

  if (!experienceId?.trim()) {
    return Response.badRequest({
      message: 'experienceId is required',
    });
  }
  if (!fileName) {
    return Response.badRequest({
      message: 'fileName is required',
    });
  }
  if (!contentType || !SUPPORTED_CONTENT_TYPES.has(contentType)) {
    return Response.badRequest({
      message: 'contentType must be one of: image/png, image/jpeg, image/gif, image/webp',
    });
  }
  if (
    typeof contentLengthBytes !== 'number' ||
    !Number.isFinite(contentLengthBytes) ||
    contentLengthBytes <= 0
  ) {
    return Response.badRequest({
      message: 'contentLengthBytes must be a positive number',
    });
  }

  const normalizedExperienceId = experienceId.trim();

  let projectRecord: ProjectRecord | undefined;
  try {
    const projectResult = await ddbClient.get({
      TableName: projectsTableName,
      Key: {
        CognitoUserId: cognitoUserId,
        ExperienceId: normalizedExperienceId,
      },
      ConsistentRead: true,
    }).promise();
    projectRecord = projectResult.Item as ProjectRecord | undefined;
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to verify project access for cognitoUserId=${cognitoUserId}, experienceId=${normalizedExperienceId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error verifying project access: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to verify project access.',
    });
  }

  if (!projectRecord) {
    return Response.notAuthorized({
      message: 'You do not have access to this project.',
    });
  }

  const strategy: UploadStrategy =
    contentLengthBytes > multipartThresholdBytes
      ? 'multipart-put'
      : 'single-part-put';

  const assetId = randomUUID();
  const uploadSessionId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + uploadUrlTtlSeconds;
  const objectKey = `${sanitizePathSegment(cognitoUserId)}/${sanitizePathSegment(normalizedExperienceId)}/${assetId}/${sanitizeFileName(fileName)}`;

  let uploadUrl: string | undefined;
  let multipartUploadId: string | undefined;
  let multipartPartCount: number | undefined;

  try {
    if (strategy === 'single-part-put') {
      uploadUrl = await s3Client.getSignedUrlPromise('putObject', {
        Bucket: assetsBucketName,
        Key: objectKey,
        ContentType: contentType,
        Expires: uploadUrlTtlSeconds,
      });
    } else {
      const createMultipartResponse = await s3Client.createMultipartUpload({
        Bucket: assetsBucketName,
        Key: objectKey,
        ContentType: contentType,
      }).promise();

      multipartUploadId = createMultipartResponse.UploadId;
      if (!multipartUploadId) {
        return Response.internalFailure({
          message: 'Failed to initialize multipart upload.',
        });
      }
      multipartPartCount = Math.ceil(contentLengthBytes / multipartPartSizeBytes);
    }
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to initialize upload for experienceId=${normalizedExperienceId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error initializing upload: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to initialize asset upload.',
    });
  }

  try {
    await ddbClient.put({
      TableName: assetsTableName,
      Item: {
        AssetId: assetId,
        CognitoUserId: cognitoUserId,
        ExperienceId: normalizedExperienceId,
        FileName: fileName,
        ContentType: contentType,
        SizeBytes: contentLengthBytes,
        ObjectKey: objectKey,
        Status: 'uploading',
        CreatedAt: now,
        UpdatedAt: now,
      },
    }).promise();

    await ddbClient.put({
      TableName: uploadsTableName,
      Item: {
        UploadSessionId: uploadSessionId,
        AssetId: assetId,
        CognitoUserId: cognitoUserId,
        ExperienceId: normalizedExperienceId,
        FileName: fileName,
        ContentType: contentType,
        SizeBytes: contentLengthBytes,
        ObjectKey: objectKey,
        Strategy: strategy,
        ExpiresAt: expiresAt,
        MultipartUploadId: multipartUploadId,
        MultipartPartSizeBytes:
          strategy === 'multipart-put' ? multipartPartSizeBytes : undefined,
        MultipartPartCount: multipartPartCount,
        CreatedAt: now,
        UpdatedAt: now,
      },
    }).promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to persist upload records for uploadSessionId=${uploadSessionId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error persisting upload records: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to persist upload session.',
    });
  }

  return Response.success({
    assetId,
    uploadSessionId,
    strategy,
    expiresAt,
    uploadUrl,
    multipartPartSizeBytes:
      strategy === 'multipart-put' ? multipartPartSizeBytes : undefined,
    multipartPartCount,
  });
};

/**
 * Entry point for the AWS Lambda handler for the StartAssetUpload operation.
 * The startAssetUploadHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = startAssetUploadHandler(...INTERCEPTORS, startAssetUpload);
