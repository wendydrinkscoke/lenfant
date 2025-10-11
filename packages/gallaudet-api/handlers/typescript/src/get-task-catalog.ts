import { DynamoDB } from 'aws-sdk';
import {
  getTaskCatalogHandler,
  GetTaskCatalogChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  TaskGradingMethod,
} from 'gallaudet-api-typescript-runtime';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';

const ddbClient = new DynamoDB.DocumentClient();
const TASK_CATALOG_TABLE_NAME = getRequiredEnv('TASK_CATALOG_TABLE_NAME');

type CatalogItem = {
  PartnerId?: string;
  PartnerName?: string;
  EntryId?: string;
  Name?: string;
  Subheading?: string;
  Instructions?: string;
  GradingMethod?: string;
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

  const SUPPORTED_GRADING_METHODS: readonly TaskGradingMethod[] = ['simple-completion'];

  const isSupportedGradingMethod = (
    method: unknown,
  ): method is TaskGradingMethod =>
    typeof method === 'string' &&
  SUPPORTED_GRADING_METHODS.includes(method as TaskGradingMethod);

  const partnersMap = new Map<string, {
    partnerId: string;
    partnerName: string;
    catalogEntries: Array<{
      entryId: string;
      name: string;
      subheading: string;
      instructions: string;
      gradingMethod: TaskGradingMethod;
    }>;
  }>();

  items.forEach((item) => {
    const partnerId = item.PartnerId;
    const entryId = item.EntryId;
    const name = item.Name;
    const subheading = item.Subheading;
    const instructions = item.Instructions;
    const gradingMethod = item.GradingMethod;

    if (
      !partnerId ||
      !entryId ||
      !name ||
      !subheading ||
      !instructions ||
      !isSupportedGradingMethod(gradingMethod)
    ) {
      logger.warn(`Skipping malformed catalog entry: ${JSON.stringify(item)}`);
      return;
    }

    if (!partnersMap.has(partnerId)) {
      partnersMap.set(partnerId, {
        partnerId,
        partnerName: item.PartnerName ?? partnerId,
        catalogEntries: [],
      });
    }

    partnersMap.get(partnerId)?.catalogEntries.push({
      entryId,
      name,
      subheading,
      instructions,
      gradingMethod,
    });
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
