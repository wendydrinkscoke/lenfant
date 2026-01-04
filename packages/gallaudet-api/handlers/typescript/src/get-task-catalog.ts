import { DynamoDB } from 'aws-sdk';
import {
  getTaskCatalogHandler,
  GetTaskCatalogChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import type { Milestone } from 'gallaudet-api-typescript-runtime';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');
const PARTNERS_TABLE_NAME = getRequiredEnv('PARTNERS_TABLE_NAME');
const PARTNERS_V2_TABLE_NAME = getRequiredEnv('PARTNERS_V2_TABLE_NAME');
const PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME = getRequiredEnv(
  'PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME',
);

type PartnersItem = {
  PartnerId?: string;
  CreatedAt?: string;
  PartnerName?: string;
  RobloxGameId?: string;
  UpdatedAt: string;
}

type PartnersV2Item = {
  ExperienceId?: string;
  PartnerId?: string;
  CreatedAt?: string;
  PartnerName?: string;
  RobloxGameId?: string;
  UpdatedAt: string;
}

type CatalogItem = {
  PartnerId?: string;
  EntryId?: string;
  CreatedAt: string;
  Name?: string;
  Subheading?: string;
  Instructions?: string;
  Milestones?: Milestone[];
};

type CatalogEntry = {
  entryId: string;
  name: string;
  subheading: string;
  instructions: string;
  milestones?: Milestone[];
};

/**
 * Type-safe handler for the GetTaskCatalog operation
 */
export const getTaskCatalog: GetTaskCatalogChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetTaskCatalog Operation');

  let items: CatalogItem[] = [];
  try {
    const result = await ddbClient.scan({
      TableName: TASK_CATALOG_TABLE_NAME,
    }).promise();
    items = (result.Items as CatalogItem[]) ?? [];
    logger.info(`Fetched ${items.length} task catalog entries`);
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(`Failed to read task catalog: ${error.code} - ${error.message}`);
      return Response.internalFailure({
        message: 'Failed to load task catalog',
        details: `DynamoDB error: ${error.code}`,
      });
    }

    logger.error(`Unexpected error loading task catalog: ${JSON.stringify(error)}`);
    return Response.internalFailure({
      message: 'Failed to load task catalog',
    });
  }

  const partnersMap = new Map<string, {
    partnerId: string;
    partnerName: string;
    catalogEntries: CatalogEntry[];
  }>();

  const partnerIds = Array.from(new Set(
    items.map((item) => item.PartnerId).filter((partnerId): partnerId is string => !!partnerId),
  ));

  const partnersById = new Map<string, PartnersItem>();
  const partnersV2ByPartnerId = new Map<string, PartnersV2Item>();
  if (partnerIds.length > 0) {
    const partnerIdToExperienceId = new Map<string, string>();
    try {
      const mappingResult = await ddbClient.batchGet({
        RequestItems: {
          [PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME]: {
            Keys: partnerIds.map((partnerId) => ({ ApiKeyId: partnerId })),
          },
        },
      }).promise();
      const mappings = (mappingResult.Responses?.[
        PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME
      ] as Array<{ ApiKeyId?: string; ExperienceId?: string }>) ?? [];
      mappings.forEach((mapping) => {
        if (mapping.ApiKeyId && mapping.ExperienceId) {
          partnerIdToExperienceId.set(mapping.ApiKeyId, mapping.ExperienceId);
        }
      });
      const unprocessed =
        mappingResult.UnprocessedKeys?.[PARTNER_API_KEY_TO_EXPERIENCE_TABLE_NAME]
          ?.Keys;
      if (unprocessed?.length) {
        logger.warn(`Unprocessed partner mapping keys: ${JSON.stringify(unprocessed)}`);
      }
      logger.info(`Fetched ${partnerIdToExperienceId.size} partner mappings`);
    } catch (error) {
      if (isAWSError(error)) {
        logger.warn(
          `Failed to read partner mappings: ${error.code} - ${error.message}`,
        );
      } else {
        logger.warn(
          `Unexpected error loading partner mappings: ${JSON.stringify(error)}`,
        );
      }
    }

    const experienceIds = Array.from(
      new Set(Array.from(partnerIdToExperienceId.values())),
    );
    if (experienceIds.length > 0) {
      try {
        const partnersV2Result = await ddbClient
          .batchGet({
            RequestItems: {
              [PARTNERS_V2_TABLE_NAME]: {
                Keys: experienceIds.map((experienceId) => ({
                  ExperienceId: experienceId,
                })),
              },
            },
          })
          .promise();
        const partnersV2 = (partnersV2Result.Responses?.[
          PARTNERS_V2_TABLE_NAME
        ] as PartnersV2Item[]) ?? [];
        const partnersV2ByExperienceId = new Map<string, PartnersV2Item>();
        partnersV2.forEach((partner) => {
          if (partner.ExperienceId) {
            partnersV2ByExperienceId.set(partner.ExperienceId, partner);
          }
        });
        partnerIdToExperienceId.forEach((experienceId, partnerId) => {
          const partner = partnersV2ByExperienceId.get(experienceId);
          if (partner) {
            partnersV2ByPartnerId.set(partnerId, partner);
          }
        });
        const unprocessed =
          partnersV2Result.UnprocessedKeys?.[PARTNERS_V2_TABLE_NAME]?.Keys;
        if (unprocessed?.length) {
          logger.warn(
            `Unprocessed partners v2 keys: ${JSON.stringify(unprocessed)}`,
          );
        }
        logger.info(`Fetched ${partnersV2ByPartnerId.size} partners v2`);
      } catch (error) {
        if (isAWSError(error)) {
          logger.warn(
            `Failed to read partners v2: ${error.code} - ${error.message}`,
          );
        } else {
          logger.warn(
            `Unexpected error loading partners v2: ${JSON.stringify(error)}`,
          );
        }
      }
    }

    const fallbackPartnerIds = partnerIds.filter(
      (partnerId) => !partnersV2ByPartnerId.has(partnerId),
    );
    if (fallbackPartnerIds.length > 0) {
      try {
        const partnersResult = await ddbClient
          .batchGet({
            RequestItems: {
              [PARTNERS_TABLE_NAME]: {
                Keys: fallbackPartnerIds.map((partnerId) => ({
                  PartnerId: partnerId,
                })),
              },
            },
          })
          .promise();
        const partners =
          (partnersResult.Responses?.[PARTNERS_TABLE_NAME] as PartnersItem[]) ??
          [];
        partners.forEach((partner) => {
          if (partner.PartnerId) {
            partnersById.set(partner.PartnerId, partner);
          }
        });
        const unprocessed =
          partnersResult.UnprocessedKeys?.[PARTNERS_TABLE_NAME]?.Keys;
        if (unprocessed?.length) {
          logger.warn(`Unprocessed partner keys: ${JSON.stringify(unprocessed)}`);
        }
        logger.info(`Fetched ${partnersById.size} partners`);
      } catch (error) {
        if (isAWSError(error)) {
          logger.error(`Failed to read partners: ${error.code} - ${error.message}`);
          return Response.internalFailure({
            message: 'Failed to load task catalog',
            details: `DynamoDB error: ${error.code}`,
          });
        }

        logger.error(`Unexpected error loading partners: ${JSON.stringify(error)}`);
        return Response.internalFailure({
          message: 'Failed to load task catalog',
        });
      }
    }
  }

  items.forEach((item) => {
    const partnerId = item.PartnerId;
    const entryId = item.EntryId;
    const name = item.Name;
    const subheading = item.Subheading;
    const instructions = item.Instructions;
    const milestones = item.Milestones;
    if (
      !partnerId ||
      !entryId ||
      !name ||
      !subheading ||
      !instructions
    ) {
      logger.warn(`Skipping malformed catalog entry: ${JSON.stringify(item)}`);
      return;
    }

    if (!partnersMap.has(partnerId)) {
      const partnerName =
        partnersV2ByPartnerId.get(partnerId)?.PartnerName ??
        partnersById.get(partnerId)?.PartnerName ??
        partnerId;
      partnersMap.set(partnerId, {
        partnerId,
        partnerName,
        catalogEntries: [],
      });
    }

    const entry: CatalogEntry = {
      entryId,
      name,
      subheading,
      instructions,
    };
    entry.milestones = milestones;
    partnersMap.get(partnerId)?.catalogEntries.push(entry);
  });

  const partners = Array.from(partnersMap.values()).map((partner) => ({
    ...partner,
    catalogEntries: partner.catalogEntries.sort((a, b) => a.name.localeCompare(b.name)),
  })).sort((a, b) => a.partnerName.localeCompare(b.partnerName));

  logger.info(`Returning catalog for ${partners.length} partners`);

  return Response.success({
    partners,
  });
};

/**
 * Entry point for the AWS Lambda handler for the GetTaskCatalog operation.
 * The getTaskCatalogHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = getTaskCatalogHandler(...INTERCEPTORS, getTaskCatalog);
