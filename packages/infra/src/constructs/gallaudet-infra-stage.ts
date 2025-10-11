import { Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  MANAGEMENT_ACCOUNT_ID,
  CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME,
  RECORD_UPDATER_ROLE_NAME_PREFIX,
} from "../constants";
import { GallaudetApiStack } from "./gallaudet-api-stack";
import { GallaudetCognitoStack } from "./gallaudet-cognito-stack";
import { GallaudetWebsiteStack } from "./gallaudet-website-stack";
import { GallaudetEmailStack } from "../stacks/gallaudet-email-stack";
import { SubdomainAssumerStack } from "../stacks/subdomain-assumer-stack";

interface GallaudetInfraStageEnvironment {
  readonly name: string; // e.g. "beta"
  readonly account: string; // e.g. "679451892070"
  readonly region: string; // e.g. "us-east-1"
}

export class GallaudetInfraStage extends Stage {
  cloudFrontDistributionDomainName: string | undefined;

  constructor(
    scope: Construct,
    id: string,
    env: GallaudetInfraStageEnvironment,
  ) {
    super(scope, id, { env });

    const subdomain = env.name;
    const assumerStack = new SubdomainAssumerStack(
      this,
      "GallaudetSubdomainAssumerStack",
      {
        parentZoneName: CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME,
        delegationRoleArn:
          `arn:aws:iam::${MANAGEMENT_ACCOUNT_ID}:role/` +
          `${RECORD_UPDATER_ROLE_NAME_PREFIX}-${subdomain}`,
        subdomain: subdomain,
        env: env,
      },
    );

    const gallaudetEmailStack = new GallaudetEmailStack(
      this,
      "GallaudetEmailStack",
      {
        zone: assumerStack.childHostedZone!,
        stage: env.name as "beta" | "gamma" | "prod",
      },
    );

    const domainPrefix = `${env.name}-gallaudet`;
    let callbackUrls = [
      `https://${assumerStack.childHostedZone!.zoneName}/cognito/callback`,
      `https://${assumerStack.childHostedZone!.zoneName}/cognito/popup-callback`,
    ];
    if (env.name === "beta") {
      callbackUrls.push("http://localhost:3000/cognito/callback");
      callbackUrls.push("http://localhost:3000/cognito/popup-callback");
    }
    if (env.name === "prod") {
      callbackUrls = [
        `https://${CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME}/cognito/callback`,
        `https://${CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME}/cognito/popup-callback`,
      ];
    }
    const gallaudetCognitoStack = new GallaudetCognitoStack(
      this,
      "GallaudetCognitoStack",
      {
        domainPrefix,
        callbackUrls,
        env: env,
      },
    );

    const gallaudetApiStack = new GallaudetApiStack(this, "GallaudetApiStack", {
      identityPool: gallaudetCognitoStack.identityPool,
      apiSubdomain: "api",
      cognitoAuthorizer: gallaudetCognitoStack.cognitoAuthorizer,
      stage: env.name,
      zone: assumerStack.childHostedZone!,
      emailIdentity: gallaudetEmailStack.emailIdentity,
      userPool: gallaudetCognitoStack.userPool,
    });

    new GallaudetWebsiteStack(this, "GallaudetWebsiteStack", {
      gallaudet: gallaudetApiStack.gallaudet,
      identityPoolId: gallaudetCognitoStack.identityPool.identityPoolId,
      userPoolId: gallaudetCognitoStack.userPool.userPoolId,
      userPoolClientId: gallaudetCognitoStack.userPoolClient.userPoolClientId,
      cognitoDomainPrefix: domainPrefix,
      zone: assumerStack.childHostedZone!,
      isProd: env.name === "prod",
      delegationRoleArn:
        `arn:aws:iam::${MANAGEMENT_ACCOUNT_ID}:role/` +
        `${RECORD_UPDATER_ROLE_NAME_PREFIX}-${subdomain}`,
    });
  }
}
