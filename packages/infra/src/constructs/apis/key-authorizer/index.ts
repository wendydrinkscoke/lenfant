import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { SecretsManager } from "aws-sdk";

const smClient = new SecretsManager();
let cachedKeys: string[] | undefined;

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  if (!cachedKeys) {
    const resp = await smClient
      .getSecretValue({ SecretId: process.env.API_KEYS_SECRET_ARN! })
      .promise();
    cachedKeys = resp.SecretString!.split(",");
  }

  const token = event.authorizationToken;
  const effect = cachedKeys!.includes(token!) ? "Allow" : "Deny";

  return {
    principalId: "user",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: event.methodArn,
        },
      ],
    },
  };
};
