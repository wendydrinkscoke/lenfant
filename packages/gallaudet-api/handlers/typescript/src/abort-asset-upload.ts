import { DynamoDB, S3 } from 'aws-sdk';
import {
  abortAssetUploadHandler,
  AbortAssetUploadChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const s3Client = new S3({ signatureVersion: 'v4' });

type UploadSessionRecord = {
  UploadSessionId?: string;
  AssetId?: string;
  CognitoUserId?: string;
  ExperienceId?: string;
  ObjectKey?: string;
  Strategy?: string;
  MultipartUploadId?: string;
};

/**
 * Type-safe handler for the AbortAssetUpload operation
 */
export const abortAssetUpload: AbortAssetUploadChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start AbortAssetUpload Operation');

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
    return Response.success({
      message: 'Upload session already cleared.',
    });
  }

  if (session.CognitoUserId !== cognitoUserId || session.ExperienceId !== experienceId) {
    return Response.notAuthorized({
      message: 'You are not authorized to abort this upload session.',
    });
  }

  if (session.Strategy === 'multipart-put' && session.MultipartUploadId && session.ObjectKey) {
    try {
      await s3Client.abortMultipartUpload({
        Bucket: assetsBucketName,
        Key: session.ObjectKey,
        UploadId: session.MultipartUploadId,
      }).promise();
    } catch (error) {
      if (isAWSError(error) && error.code === 'NoSuchUpload') {
        logger.info(
          `Multipart upload already gone for uploadSessionId=${uploadSessionId}`,
        );
      } else if (isAWSError(error)) {
        logger.error(
          `Failed to abort multipart upload for uploadSessionId=${uploadSessionId}: ${error.code} - ${error.message}`,
        );
        return Response.internalFailure({
          message: 'Failed to abort multipart upload.',
        });
      } else {
        logger.error(
          `Unexpected error aborting multipart upload: ${JSON.stringify(error)}`,
        );
        return Response.internalFailure({
          message: 'Failed to abort multipart upload.',
        });
      }
    }
  }

  try {
    await ddbClient.delete({
      TableName: uploadsTableName,
      Key: {
        UploadSessionId: uploadSessionId,
      },
    }).promise();
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to delete upload session ${uploadSessionId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Unexpected error deleting upload session ${uploadSessionId}: ${JSON.stringify(error)}`,
      );
    }
    return Response.internalFailure({
      message: 'Failed to abort upload session.',
    });
  }

  return Response.success({
    message: 'Upload session aborted.',
  });
};

/**
 * Entry point for the AWS Lambda handler for the AbortAssetUpload operation.
 * The abortAssetUploadHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = abortAssetUploadHandler(...INTERCEPTORS, abortAssetUpload);
