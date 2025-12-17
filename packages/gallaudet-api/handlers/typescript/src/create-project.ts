import { DynamoDB, SecretsManager } from 'aws-sdk';
import {
  createProjectHandler,
  CreateProjectChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
  RobloxLinkRequiredErrorResponseContent,
  ProjectAlreadyExistsErrorResponseContent,
} from 'gallaudet-api-typescript-runtime';
import { getCognitoUserIdFromEvent, getRobloxUserIdForCognitoUser } from './utils/auth-utils';
import { getRequiredEnv } from './utils/env-utils';
import { isAWSError } from './utils/error-utils';
import { getRobloxUserNameFromUserId } from './utils/roblox-utils';

const smClient = new SecretsManager();
const ddbClient = new DynamoDB.DocumentClient();

/**
 * Type-safe handler for the CreateProject operation
 */
export const createProject: CreateProjectChainedHandlerFunction = async (request) => {
  const logger = LoggingInterceptor.getLogger(request);
  logger.info('Start CreateProject Operation');

  // 1. Get environment variables needed
  let robloxApiKeySecretArn: string;
  let projectsTableName: string;
  try {
    robloxApiKeySecretArn = getRequiredEnv('ROBLOX_API_KEY_SECRET_ARN');
    projectsTableName = getRequiredEnv('PROJECTS_TABLE_NAME');
  } catch (error) {
    logger.error(`Missing required environment variable: ${error}`);
    return Response.internalFailure({
      message: 'Misconfigured lambda environment.',
    });
  }


  // 2. Extract the universe ID from the request
  const { experienceId } = request.input.requestParameters;
  logger.info(`Requested Experience ID: ${experienceId}`);

  // 3. Get the Roblox player ID associated with the calling Cognito user
  const cognitoUserId = getCognitoUserIdFromEvent(request.event);
  logger.info(`Cognito User ID: ${cognitoUserId}`);
  let robloxUserId: string;
  try {
    robloxUserId = await getRobloxUserIdForCognitoUser(cognitoUserId);
    logger.info(`Roblox User ID: ${robloxUserId}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'RobloxUserNotLinkedError') {
      logger.warn(`No Roblox User ID linked to Cognito user ID ${cognitoUserId}.`);
      return Response.notAuthorized({
        message: `No Roblox User ID linked to Cognito user ID: ${cognitoUserId}.`,
      } as RobloxLinkRequiredErrorResponseContent);
    }

    let errorMessage = 'Unknown error';
    if (isAWSError(error)) {
      errorMessage = `AWS Error (${error.code}) - ${error.message}`;
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }
    logger.error(`Failed to retrieve Roblox User ID: ${errorMessage}`);
    return Response.internalFailure({
      message: `Failed to retrieve Roblox User ID for Cognito user ID ${cognitoUserId}. Error: ${errorMessage}`,
    });
  }

  // 4. Retrieve the Roblox API key from Secrets Manager
  let robloxApiKey: string;
  try {
    const secretData = await smClient.getSecretValue({
      SecretId: robloxApiKeySecretArn,
    }).promise();
    robloxApiKey = secretData.SecretString!;
    logger.info(`Retrieved Roblox API key: ${robloxApiKey.substring(0, 4)}****`);
  } catch (error) {
    logger.error(`Failed to retrieve secret value: ${error}`);
    return Response.internalFailure({
      message: 'Failed to retrieve the Google OAuth client secret',
    });
  }

  // 5. Use the `https://apis.roblox.com/cloud/v2/universes/${universeID}` `GET` endpoint
  // to verify that the Roblox user owns the universe with the given ID. Or, if it is a
  // group-owned universe, verify that the user is the owner of the group.
  //    - If the user does not own the universe, return a NotAuthorized error response.
  // Here's an example response from that API when it's user-owned:
  // ```
  // {
  //   "path": "universes/9228429469",
  //   "createTime": "2025-11-23T05:10:36.063Z",
  //   "updateTime": "2025-11-28T14:58:56.393Z",
  //   "displayName": "Run The World! - Learn Country Names",
  //   "description": "Learn country names by running around a life-sized map of the globe! Stand on top of a country to select it. Beat other players to that country and you'll earn more points. This game also offers Google Classrooms integration via \"CivicTech for Schools\" Classroom Add-On.",
  //   "user": "users/7954006733",
  //   "visibility": "PUBLIC",
  //   "voiceChatEnabled": false,
  //   "ageRating": "AGE_RATING_UNSPECIFIED",
  //   "desktopEnabled": true,
  //   "mobileEnabled": true,
  //   "tabletEnabled": true,
  //   "consoleEnabled": false,
  //   "vrEnabled": true,
  //   "rootPlace": "universes/9228429469/places/127120714583972",
  //   "templateRootPlace": ""
  // }
  // ```
  // and here's an example response when it's group-owned:
  // ```
  // {
  //     "path": "universes/1278348231",
  //     "createTime": "2019-08-12T04:33:18.973Z",
  //     "updateTime": "2025-07-09T15:42:30.337Z",
  //     "displayName": "Washington D.C.",
  //     "description": "🇺🇸  Our Community\nWant to roleplay as Law Enforcement, Secret Service, a member of Congress, and more? Join our communications server using invite code: OSFUSA\n\n💰 Earn Free Rewards\nJoin our official Roblox group for exclusive perks, including increased pay! https://www.roblox.com/groups/1025445/USA-United-States-of-America\n\n📘Game Rules & Information can be found here: \nhttps://devforum.roblox.com/t/1434108\n\n❗ A ROBLOX join date script is installed. If your account is not old enough, please join the group! ",
  //     "group": "groups/1025445",
  //     "visibility": "PUBLIC",
  //     "discordSocialLink": {
  //         "title": "Our communications server offers a whole range of job opportunities.",
  //         "uri": "https://discord.gg/ewwDUkh"
  //     },
  //     "robloxGroupSocialLink": {
  //         "title": "Join our group for free bonuses such as increased pay!",
  //         "uri": "https://www.roblox.com/communities/1025445"
  //     },
  //     "voiceChatEnabled": true,
  //     "ageRating": "AGE_RATING_UNSPECIFIED",
  //     "privateServerPriceRobux": 71,
  //     "desktopEnabled": true,
  //     "mobileEnabled": true,
  //     "tabletEnabled": true,
  //     "consoleEnabled": false,
  //     "vrEnabled": true,
  //     "rootPlace": "universes/1278348231/places/3664995855",
  //     "templateRootPlace": ""
  // }
  // ```
  // We can also make requests to see who is the owner of a group like so:
  // `https://groups.roblox.com/v1/groups/1025445` `GET` and this returns
  // something like this:
  // ```
  // {
  //     "id": 1025445,
  //     "name": "[OSFUSA] United States of America",
  //     "description": "🇺🇸 United States of America \n■▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬■ \n💬To be fully involved in our community, Join our communications server using invite code: OSFUSA\n■▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬■\n🛠️Created January 16, 2014 | Representative Democracy \n■▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬■ \nMotto: \"E pluribus unum\" Anthem: \"The Star-Spangled Banner\" \nCapital City: https://www.roblox.com/games/3664995855/Washington-D-C \nDemonym: American \nPresident: Private_Teddy (32nd)\nForeign nations wanting to ally, use [OSFUSA] Department of State\n ■▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬■ \nThis group is not affiliated with any real life entities.",
  //     "owner": {
  //         "hasVerifiedBadge": false,
  //         "userId": 22464205,
  //         "username": "OurStandingFounder",
  //         "displayName": "OurStandingFounder"
  //     },
  //     "shout": null,
  //     "memberCount": 95118,
  //     "isBuildersClubOnly": false,
  //     "publicEntryAllowed": true,
  //     "hasVerifiedBadge": false,
  //     "hasSocialModules": true
  // }
  // ```
  const robloxApiUrl = `https://apis.roblox.com/cloud/v2/universes/${experienceId}`;
  const robloxResponse = await fetch(robloxApiUrl, {
    method: 'GET',
    headers: {
      'x-api-key': robloxApiKey,
    },
  });
  if (!robloxResponse.ok) {
    logger.error(`Failed to retrieve universe metadata from Roblox: ${robloxResponse.status} ${robloxResponse.statusText}`);
    return Response.internalFailure({
      message: 'Failed to retrieve metadata for the specified universe from Roblox.',
    });
  }
  const experienceResponseData = await robloxResponse.json();
  logger.info(`Roblox Universe Data: ${JSON.stringify(experienceResponseData)}`);
  const experienceDisplayName: string | null = experienceResponseData.displayName;
  let owningUserId = experienceResponseData.user?.split('/')[1];
  const owningGroupId = experienceResponseData.group?.split('/')[1];
  let owningGroupName: string | null = null;
  if (owningUserId == null && owningGroupId) {
    const groupResponse = await fetch(`https://groups.roblox.com/v1/groups/${owningGroupId}`, {
      method: 'GET',
    });
    if (!groupResponse.ok) {
      logger.error(`Failed to retrieve group metadata from Roblox: ${groupResponse.status} ${groupResponse.statusText}`);
      return Response.internalFailure({
        message: 'Failed to retrieve metadata for the owning group from Roblox.',
      });
    }
    const groupData = await groupResponse.json();
    logger.info(`Roblox Group Data: ${JSON.stringify(groupData)}`);
    owningUserId = groupData.owner?.userId.toString();
    try {
      owningGroupName = groupData.name;
    } catch {
      logger.warn(`Failed to get owning group name for group ID: ${owningGroupId}`);
    }
    logger.info(`Owning User ID from Group: ${owningUserId}`);
  }
  logger.info(`Owning User ID: ${owningUserId}, Calling User's Roblox ID: ${robloxUserId}`);
  let owningUserName;
  try {
    owningUserName = await getRobloxUserNameFromUserId(owningUserId, robloxApiKey);
  } catch {
    logger.warn(`Failed to get owning user name for user ID: ${owningUserId}`);
  };
  let callingUserName;
  try {
    callingUserName = await getRobloxUserNameFromUserId(robloxUserId, robloxApiKey);
  } catch {
    logger.warn(`Failed to get calling user name for user ID: ${robloxUserId}`);
  }


  if (owningUserId !== robloxUserId) {
    let callingUserDescription;
    if (callingUserName) {
      callingUserDescription = `The caller's associated Roblox account (${callingUserName})`;
    } else {
      callingUserDescription = `The caller's associated Roblox account (ID: ${robloxUserId})`;
    }
    let experienceDescription;
    if (experienceDisplayName) {
      experienceDescription = 'the experience named "' + experienceDisplayName + '".';
    } else {
      experienceDescription = 'the experience with ID ' + experienceId + '.';
    }
    let callToActionDescription;
    let owningUserDescription;
    if (owningUserName) {
      owningUserDescription = `the owner (${owningUserName})`;
    } else if (owningUserId) {
      owningUserDescription = `the owner (ID: ${owningUserId})`;
    } else {
      owningUserDescription = 'the owner';
    }
    if (owningGroupName) {
      callToActionDescription = 'Please reach out to ' + owningUserDescription + ` who owns the associated group "${owningGroupName}"`;
    } else {
      callToActionDescription = 'Please reach out to ' + owningUserDescription + '.';
    }

    const message = [
      callingUserDescription,
      'does not own the',
      experienceDescription,
      callToActionDescription,

    ].join(' ');
    return Response.notAuthorized({
      message,
    });
  }

  // 6. If the user owns the universe, create a new Project entry in the Projects DynamoDB table
  // with the ExperienceId set to the universe ID and the ProjectCreatorRobloxUserId set to the
  // Roblox user ID of the calling user. Ensure that a Project with the same ExperienceId does
  // not already exist.
  const projectItem = {
    ExperienceId: experienceId,
    ProjectCreatorRobloxUserId: robloxUserId,
    CreatedAt: new Date().toISOString(),
  };
  logger.info(`Creating Project item: ${JSON.stringify(projectItem)}`);
  try {
    await ddbClient.put({
      TableName: projectsTableName,
      Item: projectItem,
      ConditionExpression: 'attribute_not_exists(ExperienceId)',
    }).promise();
    logger.info(`Created new project entry: ${JSON.stringify(projectItem)}`);
  } catch (error) {
    if (isAWSError(error) && error.code === 'ConditionalCheckFailedException') {
      logger.warn(`Project with ExperienceId ${experienceId} already exists.`);
      const body: ProjectAlreadyExistsErrorResponseContent = {
        message: `A project for experienceId ${experienceId} already exists.`,
      };
      return { statusCode: 409, body };
    } else if (isAWSError(error)) {
      logger.error(`DynamoDB AWS Error (${error.code}): ${error.message}`);
      return Response.internalFailure({
        message: `Failed to create new project entry in the database. AWS Error (${error.code}): ${error.message}`,
      });
    }
    logger.error(`Failed to create project entry: ${error}`);
    return Response.internalFailure({
      message: 'Failed to create new project entry in the database.',
    });
  }

  // 7. Return a successful response including the created Project item
  return Response.success({
    message: 'Project created successfully.',
  });
};

/**
 * Entry point for the AWS Lambda handler for the CreateProject operation.
 * The createProjectHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = createProjectHandler(...INTERCEPTORS, createProject);
