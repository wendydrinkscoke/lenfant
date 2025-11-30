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

type PartnersItem = {
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
  if (partnerIds.length > 0) {
    try {
      const partnersResult = await ddbClient.batchGet({
        RequestItems: {
          [PARTNERS_TABLE_NAME]: {
            Keys: partnerIds.map((partnerId) => ({ PartnerId: partnerId })),
          },
        },
      }).promise();
      const partners = (partnersResult.Responses?.[PARTNERS_TABLE_NAME] as PartnersItem[]) ?? [];
      partners.forEach((partner) => {
        if (partner.PartnerId) {
          partnersById.set(partner.PartnerId, partner);
        }
      });
      const unprocessed = partnersResult.UnprocessedKeys?.[PARTNERS_TABLE_NAME]?.Keys;
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
      const partnerName = partnersById.get(partnerId)?.PartnerName ?? partnerId;
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
