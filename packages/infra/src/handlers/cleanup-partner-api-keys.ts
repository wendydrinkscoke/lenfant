import { APIGateway, DynamoDB } from "aws-sdk";

const ddbClient = new DynamoDB.DocumentClient();
const apiGateway = new APIGateway();

type PartnerApiKeyRecord = {
  ApiKeyId?: string;
  ExperienceId?: string;
  ExpiresAt?: number;
  SecretId?: string;
  Status?: string;
};

type RobloxExperienceApiKeyRecord = {
  ApiKey?: string;
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
};

const resolveUsagePlanId = async (usagePlanName: string): Promise<string> => {
  let position: string | undefined;
  do {
    const resp = await apiGateway.getUsagePlans({ position }).promise();
    const match = resp.items?.find((plan) => plan.name === usagePlanName);
    if (match?.id) {
      return match.id;
    }
    position = resp.position;
  } while (position);

  throw new Error(`Usage plan not found for name ${usagePlanName}`);
};

const deleteApiGatewayKey = async (
  apiKeyId: string,
  usagePlanId: string,
) => {
  if (usagePlanId) {
    await apiGateway.deleteUsagePlanKey({
      usagePlanId,
      keyId: apiKeyId,
    }).promise();
  }
  await apiGateway.deleteApiKey({ apiKey: apiKeyId }).promise();
};

const deleteRobloxSecret = async (
  experienceId: string,
  secretId: string,
  robloxApiKey: string,
) => {
  const deleteEndpoint =
    `https://apis.roblox.com/cloud/v2/universes/${experienceId}/secrets/${secretId}`;
  const response = await fetch(deleteEndpoint, {
    method: "DELETE",
    headers: {
      "x-api-key": robloxApiKey,
    },
  });
  return response;
};

export const handler = async () => {
  const partnerApiKeysTableName = getRequiredEnv("PARTNER_API_KEYS_TABLE_NAME");
  const robloxExperienceApiKeysTableName = getRequiredEnv(
    "ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME",
  );
  const usagePlanName = getRequiredEnv("PARTNER_API_KEY_USAGE_PLAN_NAME");

  const now = Math.floor(Date.now() / 1000);
  let usagePlanId: string;
  try {
    usagePlanId = await resolveUsagePlanId(usagePlanName);
  } catch (error) {
    console.error((error as Error).message);
    throw error;
  }

  let lastEvaluatedKey: DynamoDB.DocumentClient.Key | undefined;
  const expiredItems: PartnerApiKeyRecord[] = [];

  do {
    const result = await ddbClient.scan({
      TableName: partnerApiKeysTableName,
      ExclusiveStartKey: lastEvaluatedKey,
      FilterExpression: "#expiresAt <= :now",
      ExpressionAttributeNames: {
        "#expiresAt": "ExpiresAt",
      },
      ExpressionAttributeValues: {
        ":now": now,
      },
    }).promise();
    expiredItems.push(...((result.Items as PartnerApiKeyRecord[]) ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  if (expiredItems.length === 0) {
    console.info("No expired partner API keys found.");
    return;
  }

  for (const item of expiredItems) {
    const apiKeyId = item.ApiKeyId;
    const experienceId = item.ExperienceId;
    const secretId = item.SecretId;

    if (!apiKeyId || !experienceId) {
      console.warn(`Skipping expired record missing identifiers: ${JSON.stringify(item)}`);
      continue;
    }

    try {
      await deleteApiGatewayKey(apiKeyId, usagePlanId);
      console.info(`Deleted API Gateway key ${apiKeyId}`);
    } catch (error) {
      console.error(`Failed to delete API Gateway key ${apiKeyId}: ${JSON.stringify(error)}`);
    }

    let robloxDeleteStatus = "Expired";
    if (secretId) {
      try {
        const robloxKeyRecord = await ddbClient.get({
          TableName: robloxExperienceApiKeysTableName,
          Key: {
            ExperienceId: experienceId,
          },
        }).promise();
        const robloxApiKey = (robloxKeyRecord.Item as RobloxExperienceApiKeyRecord | undefined)?.ApiKey;
        if (robloxApiKey) {
          const response = await deleteRobloxSecret(experienceId, secretId, robloxApiKey);
          if (!response.ok && response.status !== 404) {
            robloxDeleteStatus = "Stale";
            const body = await response.text();
            console.warn(
              `Roblox secret delete failed for ${experienceId}/${secretId}: ${response.status} ${body}`,
            );
          }
        } else {
          robloxDeleteStatus = "Stale";
          console.warn(`Missing Roblox API key for experience ${experienceId}`);
        }
      } catch (error) {
        robloxDeleteStatus = "Stale";
        console.error(
          `Error deleting Roblox secret for ${experienceId}/${secretId}: ${JSON.stringify(error)}`,
        );
      }
    }

    try {
      await ddbClient.update({
        TableName: partnerApiKeysTableName,
        Key: {
          ApiKeyId: apiKeyId,
        },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
          "#status": "Status",
        },
        ExpressionAttributeValues: {
          ":status": robloxDeleteStatus,
        },
      }).promise();
    } catch (error) {
      console.error(
        `Failed to mark API key ${apiKeyId} as ${robloxDeleteStatus}: ${JSON.stringify(error)}`,
      );
    }
  }
};
