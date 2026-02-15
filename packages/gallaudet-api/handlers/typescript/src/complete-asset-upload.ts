import { DynamoDB, S3 } from 'aws-sdk';
import {
  completeAssetUploadHandler,
  CompleteAssetUploadChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  AssetContentType,
  CompleteAssetUploadRequestContent,
  CompletedUploadPart,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const s3Client = new S3({ signatureVersion: 'v4' });

const SUPPORTED_CONTENT_TYPES = new Set<AssetContentType>([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

type UploadSessionRecord = {
  UploadSessionId?: string;
  AssetId?: string;
  CognitoUserId?: string;
  ExperienceId?: string;
  FileName?: string;
  ContentType?: string;
  SizeBytes?: number;
  ObjectKey?: string;
  Strategy?: string;
  MultipartUploadId?: string;
  CreatedAt?: number;
};

const sortMultipartParts = (parts: CompletedUploadPart[]): CompletedUploadPart[] => (
  [...parts].sort((a, b) => a.partNumber - b.partNumber)
);

/**
 * Type-safe handler for the CompleteAssetUpload operation
 */
export const completeAssetUpload: CompleteAssetUploadChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CompleteAssetUpload Operation');

  let assetsBucketName: string;
  let uploadsTableName: string;
  let assetsTableName: string;
  try {
    assetsBucketName = getRequiredEnv('ASSETS_BUCKET_NAME');
    uploadsTableName = getRequiredEnv('ASSET_UPLOADS_TABLE_NAME');
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

  const { experienceId, uploadSessionId } = request.input.requestParameters;
  const body = request.input.body as CompleteAssetUploadRequestContent | undefined;

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
  if (!body?.completion) {
    return Response.badRequest({
      message: 'completion is required',
    });
  }

  const hasSinglePart = Boolean((body.completion as any).singlePart);
  const hasMultipart = Boolean((body.completion as any).multipart);
  if (hasSinglePart === hasMultipart) {
    return Response.badRequest({
      message: 'completion must include exactly one of singlePart or multipart',
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
      message: 'You are not authorized to complete this upload session.',
    });
  }

  if (!session.AssetId || !session.ObjectKey || !session.ContentType || !session.FileName || typeof session.SizeBytes !== 'number') {
    return Response.internalFailure({
      message: 'Upload session metadata is incomplete.',
    });
  }
  if (!SUPPORTED_CONTENT_TYPES.has(session.ContentType as AssetContentType)) {
    return Response.internalFailure({
      message: 'Upload session content type is invalid.',
    });
  }

  const contentType = session.ContentType as AssetContentType;

  if (session.Strategy === 'single-part-put') {
    const eTag = (body.completion as any).singlePart?.eTag?.trim();
    if (!eTag) {
      return Response.badRequest({
        message: 'singlePart.eTag is required for single-part uploads',
      });
    }
  } else if (session.Strategy === 'multipart-put') {
    if (!session.MultipartUploadId) {
      return Response.internalFailure({
        message: 'Upload session is missing multipart metadata.',
      });
    }

    const rawParts = (body.completion as any).multipart?.parts as CompletedUploadPart[] | undefined;
    if (!Array.isArray(rawParts) || rawParts.length === 0) {
      return Response.badRequest({
        message: 'multipart.parts must include at least one completed part',
      });
    }

    const normalizedParts = sortMultipartParts(rawParts);
    try {
      await s3Client.completeMultipartUpload({
        Bucket: assetsBucketName,
        Key: session.ObjectKey,
        UploadId: session.MultipartUploadId,
        MultipartUpload: {
          Parts: normalizedParts.map((part) => ({
            ETag: part.eTag,
            PartNumber: part.partNumber,
          })),
        },
      }).promise();
    } catch (error) {
      if (isAWSError(error)) {
        logger.error(
          `Failed to complete multipart upload for uploadSessionId=${uploadSessionId}: ${error.code} - ${error.message}`,
        );
      } else {
        logger.error(
          `Unexpected error completing multipart upload: ${JSON.stringify(error)}`,
        );
      }
      return Response.internalFailure({
        message: 'Failed to complete multipart upload.',
      });
    }
  } else {
    return Response.badRequest({
      message: 'Upload session has unknown strategy.',
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const asset = {
    assetId: session.AssetId,
    experienceId,
    fileName: session.FileName,
    contentType,
    sizeBytes: session.SizeBytes,
    objectKey: session.ObjectKey,
    status: 'ready' as const,
    createdAt: session.CreatedAt ?? now,
    updatedAt: now,
  };

  try {
    await ddbClient.put({
      TableName: assetsTableName,
      Item: {
        AssetId: asset.assetId,
        CognitoUserId: cognitoUserId,
        ExperienceId: asset.experienceId,
        FileName: asset.fileName,
        ContentType: asset.contentType,
        SizeBytes: asset.sizeBytes,
        ObjectKey: asset.objectKey,
        Status: asset.status,
        CreatedAt: asset.createdAt,
        UpdatedAt: asset.updatedAt,
      },
    }).promise();

    await ddbClient.delete({
      TableName: uploadsTableName,
      Key: {
        UploadSessionId: uploadSessionId,
      },
    }).promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to persist completed asset for uploadSessionId=${uploadSessionId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error persisting completed asset: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to persist completed asset.',
    });
  }

  return Response.success({
    asset,
  });
};

/**
 * Entry point for the AWS Lambda handler for the CompleteAssetUpload operation.
 * The completeAssetUploadHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = completeAssetUploadHandler(...INTERCEPTORS, completeAssetUpload);
