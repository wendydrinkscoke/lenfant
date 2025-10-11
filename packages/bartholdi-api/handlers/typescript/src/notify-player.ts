import * as http2 from 'http2';
import {
  CognitoIdentityServiceProvider,
  DynamoDB,
  SecretsManager,
} from 'aws-sdk';
import {
  notifyPlayerHandler,
  NotifyPlayerChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'bartholdi-api-typescript-runtime';
import jwt from 'jsonwebtoken';

const smClient = new SecretsManager();
const ddbClient = new DynamoDB.DocumentClient();
const cognitoIdpClient = new CognitoIdentityServiceProvider();

export const notifyPlayer: NotifyPlayerChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start NotifyPlayer Operation');

  try {
    const { title, subtitle, body } = request.input.body;
    const { playerId } = request.input.requestParameters;

    logger.info(`${JSON.stringify(process.env)}`);
    logger.info(`${JSON.stringify(request.input.body)}`);
    logger.info(`${JSON.stringify(request.input.requestParameters)}`);
    logger.info(`${JSON.stringify(request)}`);

    const userPoolId = process.env.USER_POOL_ID!;
    const listResp = await cognitoIdpClient
      .listUsers({
        UserPoolId: userPoolId,
        Filter: `custom:robloxUserId = "${playerId}"`,
        Limit: 1,
      })
      .promise();

    logger.info(`${listResp}`);

    if (!listResp.Users || listResp.Users.length === 0) {
      logger.warn('No Cognito user found for this playerId');
      return Response.notFound({ message: 'No Cognito user found for player' });
    }
    const cognitoUserId = listResp.Users[0].Username!;
    logger.info(`${cognitoUserId}`);

    const tableName = process.env.DEVICE_TOKEN_TABLE_NAME!;
    const tokenResp = await ddbClient
      .query({
        TableName: tableName,
        KeyConditionExpression: 'CognitoUserId = :uid',
        ExpressionAttributeValues: { ':uid': cognitoUserId },
      })
      .promise();
    logger.info(`${tokenResp}`);

    const items = tokenResp.Items ?? [];
    if (items.length === 0) {
      logger.info('No device tokens to notify');
      return Response.notFound({ message: 'No device tokens registered for this user' });
    }
    const deviceTokens = items.map((i) => i.DeviceToken as string);
    logger.info(`${deviceTokens}`);

    const secretArn = process.env.APNS_AUTH_KEY_SECRET_ARN!;
    const secretVal = await smClient.getSecretValue({ SecretId: secretArn }).promise();
    const privateKey = secretVal.SecretString!;
    const keyId = process.env.APNS_KEY_ID!;
    const teamId = process.env.APNS_TEAM_ID!;
    const now = Math.floor(Date.now() / 1000);
    const apnsJwt = jwt.sign(
      { iss: teamId, iat: now },
      privateKey,
      { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId } },
    );

    logger.info(`${apnsJwt}`);
    const isProd = process.env.APNS_ENV === 'production';
    const apnsHost = isProd
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
    const topic = process.env.APNS_TOPIC!;

    let success = 0, failure = 0;
    await Promise.all(deviceTokens.map(async (deviceToken) => {
      const client = http2.connect(apnsHost);
      logger.info('connecting');
      return new Promise<void>((resolve) => {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${deviceToken}`,
          'authorization': `bearer ${apnsJwt}`,
          'apns-topic': topic,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        });

        const payload = JSON.stringify({
          aps: {
            alert: { title, subtitle, body },
            sound: 'default',
          },
        });
        req.write(payload);

        req.on('response', (headers) => {
          const status = headers[':status'];
          if (status === 200) {
            success++;
          } else {
            failure++;
            logger.error('APNS error response');
          }
        });

        req.setEncoding('utf8');
        req.on('data', () => {});
        req.on('end', () => {
          req.close();
          client.close();
          resolve();
        });
        req.on('error', (err) => {
          failure++;
          logger.error(`Error sending to APNS: ${err}`);
          req.close();
          client.close();
          resolve();
        });
      });
    }));

    logger.info('Finished NotifyPlayer Operation');
    return Response.success(undefined);
  } catch (err) {
    logger.error(`Unhandled error ${err}`);
    return Response.internalFailure({ message: 'Failed to send notifications' });
  }
};

export const handler = notifyPlayerHandler(...INTERCEPTORS, notifyPlayer);
