import { DynamoDB } from 'aws-sdk';
import { LoggingInterceptor } from 'gallaudet-api-typescript-runtime';
import { getRequiredEnv } from './env-utils';
import { isAWSError } from './error-utils';
import { getRobloxExperienceNameFromUniverseId } from './roblox-utils';

const ddbClient = new DynamoDB.DocumentClient();
const EXPERIENCES_TABLE_NAME = getRequiredEnv('EXPERIENCES_TABLE_NAME');
const DEFAULT_EXPERIENCE_NAME_REFRESH_TTL_SECONDS = 24 * 60 * 60;

type Logger = ReturnType<typeof LoggingInterceptor.getLogger>;

type ExperienceItem = {
  ExperienceId?: string;
  ExperienceName?: string;
  ExperienceNameFetchedAt?: string;
  RobloxGameId?: string;
  AssetIds?: string[];
};

export type ResolvedExperienceMetadata = {
  experienceId: string;
  experienceName: string;
  experienceNameFetchedAt: string;
  robloxGameId?: string;
  assetIds?: string[];
};

const getRefreshTtlSeconds = (): number => {
  const rawValue = process.env.EXPERIENCE_NAME_REFRESH_TTL_SECONDS;
  if (!rawValue) {
    return DEFAULT_EXPERIENCE_NAME_REFRESH_TTL_SECONDS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EXPERIENCE_NAME_REFRESH_TTL_SECONDS;
  }

  return parsed;
};

const isExperienceNameRefreshRequired = (
  experience: ExperienceItem,
  nowMs: number,
  refreshTtlSeconds: number,
): boolean => {
  const name = experience.ExperienceName?.trim();
  const fetchedAt = experience.ExperienceNameFetchedAt?.trim();
  if (!name || !fetchedAt) {
    return true;
  }

  const fetchedAtMs = Date.parse(fetchedAt);
  if (!Number.isFinite(fetchedAtMs)) {
    return true;
  }

  return nowMs - fetchedAtMs >= refreshTtlSeconds * 1000;
};

const toResolvedExperienceMetadata = (
  experience: ExperienceItem,
  experienceId: string,
): ResolvedExperienceMetadata => {
  const trimmedName = experience.ExperienceName?.trim();
  const trimmedFetchedAt = experience.ExperienceNameFetchedAt?.trim();

  if (!trimmedName || !trimmedFetchedAt) {
    throw new Error(`Experience ${experienceId} has incomplete name metadata.`);
  }

  return {
    experienceId,
    experienceName: trimmedName,
    experienceNameFetchedAt: trimmedFetchedAt,
    ...(experience.RobloxGameId !== undefined
      ? { robloxGameId: experience.RobloxGameId }
      : {}),
    ...(experience.AssetIds !== undefined ? { assetIds: experience.AssetIds } : {}),
  };
};

const refreshExperienceName = async (
  experienceId: string,
  existing: ExperienceItem,
  logger: Logger,
): Promise<ResolvedExperienceMetadata> => {
  const previousName = existing.ExperienceName?.trim();

  try {
    const experienceName = await getRobloxExperienceNameFromUniverseId(experienceId);
    const nowIso = new Date().toISOString();
    await ddbClient.update({
      TableName: EXPERIENCES_TABLE_NAME,
      Key: {
        ExperienceId: experienceId,
      },
      UpdateExpression: 'SET #experienceName = :experienceName, #experienceNameFetchedAt = :experienceNameFetchedAt, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#experienceName': 'ExperienceName',
        '#experienceNameFetchedAt': 'ExperienceNameFetchedAt',
        '#updatedAt': 'UpdatedAt',
      },
      ExpressionAttributeValues: {
        ':experienceName': experienceName,
        ':experienceNameFetchedAt': nowIso,
        ':updatedAt': nowIso,
      },
      ConditionExpression: 'attribute_exists(ExperienceId)',
      ReturnValues: 'NONE',
    }).promise();

    logger.info(`Refreshed experience name from Roblox for experienceId=${experienceId}`);
    return {
      experienceId,
      experienceName,
      experienceNameFetchedAt: nowIso,
      ...(existing.RobloxGameId !== undefined ? { robloxGameId: existing.RobloxGameId } : {}),
      ...(existing.AssetIds !== undefined ? { assetIds: existing.AssetIds } : {}),
    };
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `Failed to refresh/persist experience name for experienceId=${experienceId}: ${error.code} - ${error.message}`,
      );
    } else {
      logger.error(
        `Failed to refresh/persist experience name for experienceId=${experienceId}: ${(error as Error).message}`,
      );
    }
    // TODO(metrics): emit a metric when experience-name refresh fails.

    if (previousName) {
      logger.warn(
        `Falling back to cached experience name for experienceId=${experienceId} after refresh failure`,
      );
      return {
        experienceId,
        experienceName: previousName,
        experienceNameFetchedAt: existing.ExperienceNameFetchedAt?.trim() ?? new Date().toISOString(),
        ...(existing.RobloxGameId !== undefined ? { robloxGameId: existing.RobloxGameId } : {}),
        ...(existing.AssetIds !== undefined ? { assetIds: existing.AssetIds } : {}),
      };
    }

    throw new Error(
      `Unable to resolve experience name for experienceId=${experienceId}; no cached value is available.`,
    );
  }
};

const loadExperience = async (
  experienceId: string,
): Promise<ExperienceItem | undefined> => {
  const result = await ddbClient.get({
    TableName: EXPERIENCES_TABLE_NAME,
    Key: {
      ExperienceId: experienceId,
    },
  }).promise();

  return result.Item as ExperienceItem | undefined;
};

export const getExperienceWithResolvedName = async (
  experienceId: string,
  logger: Logger,
): Promise<ResolvedExperienceMetadata> => {
  let experience: ExperienceItem | undefined;
  try {
    experience = await loadExperience(experienceId);
  } catch (error) {
    if (isAWSError(error)) {
      throw new Error(
        `DynamoDB error reading experience ${experienceId}: ${error.code}`,
      );
    }
    throw error;
  }

  if (!experience) {
    throw new Error(`Experience entry missing for experienceId=${experienceId}`);
  }

  const nowMs = Date.now();
  const refreshTtlSeconds = getRefreshTtlSeconds();
  if (isExperienceNameRefreshRequired(experience, nowMs, refreshTtlSeconds)) {
    return refreshExperienceName(experienceId, experience, logger);
  }

  return toResolvedExperienceMetadata(experience, experienceId);
};

export const getExperiencesWithResolvedNames = async (
  experienceIds: readonly string[],
  logger: Logger,
): Promise<Map<string, ResolvedExperienceMetadata>> => {
  const dedupedExperienceIds = Array.from(
    new Set(
      experienceIds.map((id) => id.trim()).filter((id) => id.length > 0),
    ),
  );

  if (dedupedExperienceIds.length === 0) {
    return new Map();
  }

  let experiencesResult: DynamoDB.DocumentClient.BatchGetItemOutput;
  try {
    experiencesResult = await ddbClient.batchGet({
      RequestItems: {
        [EXPERIENCES_TABLE_NAME]: {
          Keys: dedupedExperienceIds.map((experienceId) => ({ ExperienceId: experienceId })),
        },
      },
    }).promise();
  } catch (error) {
    if (isAWSError(error)) {
      throw new Error(`DynamoDB error reading experiences: ${error.code}`);
    }
    throw error;
  }

  const unprocessedKeys = experiencesResult.UnprocessedKeys?.[EXPERIENCES_TABLE_NAME]?.Keys;
  if (unprocessedKeys && unprocessedKeys.length > 0) {
    throw new Error(`Unprocessed experience keys encountered: ${JSON.stringify(unprocessedKeys)}`);
  }

  const experiences = (experiencesResult.Responses?.[EXPERIENCES_TABLE_NAME] as ExperienceItem[]) ?? [];
  const experiencesById = new Map<string, ExperienceItem>();
  experiences.forEach((experience) => {
    if (experience.ExperienceId) {
      experiencesById.set(experience.ExperienceId, experience);
    }
  });

  const resolvedById = new Map<string, ResolvedExperienceMetadata>();
  const nowMs = Date.now();
  const refreshTtlSeconds = getRefreshTtlSeconds();
  for (const experienceId of dedupedExperienceIds) {
    const experience = experiencesById.get(experienceId);
    if (!experience) {
      throw new Error(`Experience entry missing for experienceId=${experienceId}`);
    }

    if (isExperienceNameRefreshRequired(experience, nowMs, refreshTtlSeconds)) {
      resolvedById.set(
        experienceId,
        await refreshExperienceName(experienceId, experience, logger),
      );
    } else {
      resolvedById.set(experienceId, toResolvedExperienceMetadata(experience, experienceId));
    }
  }

  return resolvedById;
};
