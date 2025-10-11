import { Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  BARTHOLDI_ORG_HOSTED_ZONE_NAME,
  MANAGEMENT_ACCOUNT_ID,
  RECORD_UPDATER_ROLE_NAME_PREFIX,
} from "../constants";
import { BartholdiApplicationStack } from "../stacks/bartholdi-application-stack";
import { BartholdiCognitoStack } from "../stacks/bartholdi-cognito-stack";
import { SubdomainAssumerStack } from "../stacks/subdomain-assumer-stack";

interface BartholdiInfraStageEnvironment {
  readonly name: string; // e.g. "beta"
  readonly account: string; // e.g. "679451892070"
  readonly region: string; // e.g. "us-east-1"
}

export class BartholdiInfraStage extends Stage {
  constructor(
    scope: Construct,
    id: string,
    env: BartholdiInfraStageEnvironment,
  ) {
    super(scope, id, { env });

    const subdomain = `${env.region}-${env.name}`;
    const assumerStack = new SubdomainAssumerStack(
      this,
      "BartholdiSubdomainAssumerStack",
      {
        parentZoneName: BARTHOLDI_ORG_HOSTED_ZONE_NAME,
        delegationRoleArn:
          `arn:aws:iam::${MANAGEMENT_ACCOUNT_ID}:role/` +
          `${RECORD_UPDATER_ROLE_NAME_PREFIX}-${subdomain}`,
        subdomain: subdomain,
        env: env,
      },
    );

    const cognitoStack = new BartholdiCognitoStack(
      this,
      "BartholdiCognitoStack",
      {
        domainPrefix: `${env.name}-bartholdi`,
        callbackUrls: ["bartholdi://callback"],
        env: env,
      },
    );

    new BartholdiApplicationStack(this, "BartholdiApplicationStack", {
      identityPool: cognitoStack.identityPool,
      cognitoAuthorizer: cognitoStack.cognitoAuthorizer,
      env: env,
      zone: assumerStack.childHostedZone!, // It can't be null after `asummerStack` deploys.
      stage: env.name,
    });
  }
}
