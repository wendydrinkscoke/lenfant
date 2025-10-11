import { SecretsManager } from 'aws-sdk';
import {
  getCongressInfoHandler,
  GetCongressInfoChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'bartholdi-api-typescript-runtime';


const smClient = new SecretsManager();

export const getCongressInfo: GetCongressInfoChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start GetCongressInfo Operation');

  logger.info('Retrieving secret ARN from lambda environment variables');
  const legislativeApiSecretArn = process.env.LEGISLATIVE_API_SECRET_ARN;
  if (!legislativeApiSecretArn) {
    return Response.internalFailure({
      message: 'Misconfigured lambda environment.',
    });
  }

  let secretData;
  try {
    secretData = await smClient.getSecretValue({
      SecretId: legislativeApiSecretArn,
    }).promise();
  } catch (error) {
    logger.error('Failed to retrieve secret value');
    return Response.internalFailure({
      message: 'Failed to retrieve API secret for the legislative API.',
    });
  }

  const secretString = secretData.SecretString;
  if (!secretString) {
    return Response.internalFailure({
      message: 'API secret string is missing from Secrets Manager.',
    });
  }

  let apiKeyValue;
  try {
    // I stored the key as a key-value pair with "key" as the key name.
    const parsed = JSON.parse(secretString);
    if (parsed.key as string) apiKeyValue = parsed.key;
  } catch {
    logger.error('Failed to parse secret string');
    return Response.internalFailure({
      message: 'Invalid API secret format.',
    });
  }

  // https://legislative.civictech.llc/api-docs#tag/congress-info
  const response = await fetch('https://legislative.civictech.llc/api/congressInfo', {
    method: 'GET',
    headers: {
      'x-api-key': apiKeyValue as string,
    },
  });

  if (!response.ok) {
    logger.error('Failed to fetch data from legislative API', {
      status: response.status,
      statusText: response.statusText,
    });
    return Response.internalFailure({
      message: 'Failed to fetch data from the legislative API.',
    });
  }

  const data = await response.json();
  logger.info('Successfully fetched data from legislative API', { data });
  if (!data || !data.data || typeof data.data.senateMembers !== 'number') {
    logger.error('Invalid data structure from legislative API', { data });
    return Response.internalFailure({
      message: 'Invalid data structure received from the legislative API.',
    });
  }

  return Response.success({
    senateMembers: data.data.senateMembers,
  });
};

export const handler = getCongressInfoHandler(...INTERCEPTORS, getCongressInfo);
