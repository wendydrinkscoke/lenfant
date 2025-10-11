import { DynamoDB } from 'aws-sdk';
import {
  saveDeviceTokenHandler,
  SaveDeviceTokenChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'bartholdi-api-typescript-runtime';


/**
 * Type-safe handler for the SaveDeviceToken operation
 */
export const saveDeviceToken: SaveDeviceTokenChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start SaveDeviceToken Operation');
  const cognitoUserId = request.event.requestContext.authorizer?.claims.sub;
  const { input } = request;
  const { body } = input;
  const { uuid, platform, deviceToken } = body;

  const ddbClient = new DynamoDB.DocumentClient();

  const tableName = process.env.DEVICE_TOKEN_TABLE_NAME;
  if (!tableName) {
    return Response.internalFailure({ message: 'Environment Misconfiguration' });
  }

  const item = {
    CognitoUserId: cognitoUserId,
    DeviceId: uuid,
    Platform: platform,
    DeviceToken: deviceToken,
  };

  try {
    await ddbClient.put({
      TableName: tableName,
      Item: item,
    }).promise();
    logger.info('Saved device token', { cognitoUserId: cognitoUserId, deviceId: uuid });
    return Response.success({ message: 'Device token saved' });
  } catch (e) {
    logger.error(`An error occurred: ${e}`);
    return Response.internalFailure({ message: 'Unable to save device token' });
  }
};

/**
 * Entry point for the AWS Lambda handler for the SaveDeviceToken operation.
 * The saveDeviceTokenHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = saveDeviceTokenHandler(...INTERCEPTORS, saveDeviceToken);
