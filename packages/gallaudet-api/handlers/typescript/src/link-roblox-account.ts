import { CognitoIdentityServiceProvider } from 'aws-sdk';
import {
  linkRobloxAccountHandler,
  LinkRobloxAccountChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';
import {
  decodeRobloxIdToken,
  extractRobloxUserId,
  parseIdentitiesClaim,
  RobloxIdTokenClaims,
} from './utils/roblox-utils';

const cognito = new CognitoIdentityServiceProvider();

/**
 * Type-safe handler for the LinkRobloxAccount operation
 */
export const linkRobloxAccount: LinkRobloxAccountChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start LinkRobloxAccount Operation');

  const { input } = request;
  const robloxIdToken = input.body?.robloxIdToken;
  if (!robloxIdToken) {
    logger.warn('Missing robloxIdToken in request body');
    return Response.badRequest({
      message: 'robloxIdToken is required',
    });
  }

  let userPoolId: string;
  let robloxProviderName: string;
  try {
    userPoolId = getRequiredEnv('USER_POOL_ID');
    robloxProviderName = getRequiredEnv('ROBLOX_PROVIDER_NAME');
  } catch (err) {
    logger.error((err as Error).message);
    return Response.internalFailure({
      message: 'Configuration error',
    });
  }

  const claims = request.event.requestContext.authorizer?.claims;
  const googleSub = claims?.sub as string | undefined;
  if (!googleSub) {
    logger.warn('Missing authenticated user sub claim');
    return Response.notAuthorized({
      message: 'Authentication required',
    });
  }
  const googleUsername = claims?.['cognito:username'] as string | undefined;
  if (!googleUsername) {
    logger.error(
      `Missing cognito:username claim for Google user sub ${googleSub}`,
    );
    return Response.internalFailure({
      message: 'Unable to determine Cognito username for authenticated user',
    });
  }
  logger.info(
    `Authenticated Google user sub: ${googleSub}, username: ${googleUsername}`,
  );

  let decoded: RobloxIdTokenClaims;
  try {
    decoded = decodeRobloxIdToken(robloxIdToken);
  } catch (err) {
    logger.warn(`Failed to decode Roblox token: ${(err as Error).message}`);
    return Response.badRequest({
      message: 'Invalid robloxIdToken',
    });
  }

  const robloxCognitoSub = decoded.sub;
  if (!robloxCognitoSub) {
    logger.warn('Roblox token missing sub claim');
    return Response.badRequest({
      message: 'robloxIdToken missing subject',
    });
  }
  logger.info(`Roblox Cognito sub parsed from token: ${robloxCognitoSub}`);

  const region = userPoolId.includes('_') ? userPoolId.split('_')[0] : undefined;
  const expectedIssuers =
    region && region.length > 0
      ? [
        `https://cognito-idp.${region}.amazoncognito.com/${userPoolId}`,
        `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      ]
      : [];

  if (
    expectedIssuers.length > 0 &&
   decoded.iss &&
    !expectedIssuers.includes(decoded.iss)
  ) {
    logger.warn(
      `Unexpected issuer in robloxIdToken: expected one of ${expectedIssuers.join(
        ', ',
      )}, received ${decoded.iss}`,
    );
    return Response.badRequest({
      message: 'robloxIdToken issuer mismatch',
    });
  }
  logger.info(
    `Issuer ${decoded.iss ?? 'undefined'} accepted for userPoolId ${userPoolId}`,
  );

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < nowInSeconds) {
    logger.warn('Roblox token has expired');
    return Response.badRequest({
      message: 'robloxIdToken expired',
    });
  }

  if (decoded.token_use && decoded.token_use !== 'id') {
    logger.warn(`Unexpected token_use in robloxIdToken: ${decoded.token_use}`);
    return Response.badRequest({
      message: 'robloxIdToken must be an ID token',
    });
  }

  const robloxUserId = decoded['custom:robloxUserId'];
  if (!robloxUserId) {
    logger.warn('Roblox token missing custom:robloxUserId claim');
    return Response.badRequest({
      message: 'robloxIdToken missing Roblox user identifier',
    });
  }
  logger.info(`Roblox userId from token: ${robloxUserId}`);

  try {
    const googleUser = await cognito
      .adminGetUser({
        UserPoolId: userPoolId,
        Username: googleUsername,
      })
      .promise();
    logger.info(
      `Fetched destination user ${googleUser.Username ?? googleUsername} (enabled=${googleUser.Enabled})`,
    );

    const existingRobloxId = extractRobloxUserId(googleUser.UserAttributes);
    if (existingRobloxId && existingRobloxId !== robloxUserId) {
      logger.warn(
        `User ${googleSub} already linked to Roblox ID ${existingRobloxId}, refusing to link ${robloxUserId}`,
      );
      return Response.badRequest({
        message: 'Roblox account already linked to a different user',
      });
    }
    logger.info(
      existingRobloxId
        ? `User already has matching Roblox ID ${existingRobloxId}`
        : 'No existing Roblox ID found on user',
    );

    if (existingRobloxId && existingRobloxId === robloxUserId) {
      logger.info(
        `Roblox ID ${robloxUserId} already linked to Cognito user ${googleUsername}; skipping relink.`,
      );
      return Response.success({
        message: 'Roblox account already linked',
      });
    }

    const identities = parseIdentitiesClaim(claims?.identities);
    const alreadyLinked = identities.some(
      (identity) =>
        identity.providerName === robloxProviderName ||
        identity.providerName === `cognito-idp.${region}.amazoncognito.com/${robloxProviderName}`,
    );
    logger.info(
      `Identities on incoming token: ${JSON.stringify(
        identities,
      )}. alreadyLinked (from claims) = ${alreadyLinked}`,
    );

    const robloxUsername = `${robloxProviderName}_${robloxUserId}`;
    if (!alreadyLinked) {
      try {
        const robloxStandaloneUser = await cognito
          .adminGetUser({
            UserPoolId: userPoolId,
            Username: robloxUsername,
          })
          .promise();
        logger.info(
          `Found standalone Roblox user ${robloxUsername} (sub=${extractRobloxUserId(
            robloxStandaloneUser.UserAttributes,
          )}) – deleting prior to linking.`,
        );
        await cognito
          .adminDeleteUser({
            UserPoolId: userPoolId,
            Username: robloxUsername,
          })
          .promise();
        logger.info(
          `Deleted standalone Roblox user ${robloxUsername} before link.`,
        );
      } catch (deleteErr) {
        if (isAWSError(deleteErr) && deleteErr.code === 'UserNotFoundException') {
          logger.info(
            `No standalone Roblox user ${robloxUsername} to delete; proceeding.`,
          );
        } else if (isAWSError(deleteErr)) {
          logger.error(
            `Failed to verify/delete standalone Roblox user ${robloxUsername}: ${deleteErr.code} - ${deleteErr.message}`,
          );
          return Response.internalFailure({
            message: 'Failed to prepare Roblox account for linking',
          });
        } else {
          logger.error(
            `Unexpected error inspecting standalone Roblox user ${robloxUsername}: ${JSON.stringify(deleteErr)}`,
          );
          return Response.internalFailure({
            message: 'Failed to prepare Roblox account for linking',
          });
        }
      }
    }

    if (!alreadyLinked) {
      logger.info(
        `Linking provider ${robloxProviderName} subject ${robloxUserId} to Cognito username ${googleUser.Username}`,
      );
      await cognito
        .adminLinkProviderForUser({
          UserPoolId: userPoolId,
          DestinationUser: {
            ProviderName: 'Cognito',
            ProviderAttributeName: 'Username',
            ProviderAttributeValue: googleUser.Username ?? googleUsername,
          },
          SourceUser: {
            ProviderName: robloxProviderName,
            ProviderAttributeName: 'Cognito_Subject',
            ProviderAttributeValue: robloxUserId,
          },
        })
        .promise();
      logger.info(
        `Linked Roblox provider user ${robloxCognitoSub} to Cognito user ${googleSub}`,
      );
    } else {
      logger.info(
        `Roblox provider already linked for Cognito user ${googleSub}; ensuring attributes are updated`,
      );
    }

    if (!existingRobloxId || existingRobloxId !== robloxUserId) {
      await cognito
        .adminUpdateUserAttributes({
          UserPoolId: userPoolId,
          Username: googleUser.Username ?? googleUsername,
          UserAttributes: [
            {
              Name: 'custom:robloxUserId',
              Value: robloxUserId,
            },
          ],
        })
        .promise();
      logger.info(
        `Updated custom:robloxUserId for Cognito user ${googleUser.Username ?? googleUsername} to ${robloxUserId}`,
      );
    }

    return Response.success({
      message: 'Roblox account linked successfully',
    });
  } catch (error) {
    if (isAWSError(error)) {
      logger.error(
        `AWS error while linking Roblox account: ${error.code} - ${error.message}`,
      );
      if (error.code === 'AliasExistsException') {
        return Response.badRequest({
          message: 'Roblox account is already linked to another user',
        });
      }
      if (error.code === 'ResourceNotFoundException') {
        return Response.badRequest({
          message: 'Roblox session has expired. Please restart the sign-in process.',
        });
      }
    }
    logger.error(`Failed to link Roblox account: ${JSON.stringify(error)}`);
    return Response.internalFailure({
      message: 'Failed to link Roblox account',
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the LinkRobloxAccount operation.
 * The linkRobloxAccountHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = linkRobloxAccountHandler(...INTERCEPTORS, linkRobloxAccount);
