import { CognitoAuthorizer } from "@aws/pdk/type-safe-api";
import { Stack, StackProps } from "aws-cdk-lib";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { EmailIdentity } from "aws-cdk-lib/aws-ses";
import { Construct } from "constructs";
import { CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME } from "../constants";
import { Gallaudet } from "./apis/gallaudet";

interface GallaudetApiStackProps extends StackProps {
  readonly identityPool: IdentityPool;
  readonly apiSubdomain: string;
  readonly cognitoAuthorizer: CognitoAuthorizer;
  readonly zone: HostedZone;
  readonly stage: string;
  readonly emailIdentity: EmailIdentity;
  readonly userPool: UserPool;
}

export class GallaudetApiStack extends Stack {
  gallaudet: Gallaudet;

  constructor(scope: Construct, id: string, props: GallaudetApiStackProps) {
    super(scope, id, props);

    const robloxExperienceApiKeysTable = new Table(this, "RobloxApiKeysTable", {
      tableName: "ExperienceApiKeys",
      partitionKey: {
        name: "CognitoUserId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "ExperienceId",
        type: AttributeType.STRING,
      },
    });

    const gallaudetApiKeysTable = new Table(this, "GallaudetApiKeysTable", {
      tableName: "GallaudetApiKeys",
      partitionKey: {
        name: "ApiGatewayKeyId",
        type: AttributeType.STRING,
      },
    });

    const oauthTokensTable = new Table(this, "OAuthTokensDDBTable", {
      tableName: "OAuthTokens",
      partitionKey: {
        name: "CognitoUserId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "Provider",
        type: AttributeType.STRING,
      },
    });

    const taskCatalogTable = new Table(this, "TaskCatalogDDBTable", {
      tableName: "TaskCatalog",
      partitionKey: {
        name: "ExperienceId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "EntryId",
        type: AttributeType.STRING,
      },
    });

    const taskInstancesTable = new Table(this, "TaskInstanceDDBTable", {
      tableName: "TaskInstances",
      partitionKey: {
        name: "InstanceId",
        type: AttributeType.STRING,
      },
    });
    taskInstancesTable.addGlobalSecondaryIndex({
      indexName: "AttachmentIdIndex",
      partitionKey: {
        name: "AttachmentId",
        type: AttributeType.STRING,
      },
    });

    const experiencesTable = new Table(this, "ExperiencesDDBTable", {
      tableName: "Experiences",
      partitionKey: {
        name: "ExperienceId",
        type: AttributeType.STRING,
      },
    });

    const projectsTable = new Table(this, "ProjectsDDBTable", {
      tableName: "Projects",
      partitionKey: {
        name: "CognitoUserId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "ExperienceId",
        type: AttributeType.STRING,
      },
    });

    const usersTable = new Table(this, "UsersDDBTable", {
      tableName: "Users",
      partitionKey: {
        name: "CognitoUserId",
        type: AttributeType.STRING,
      },
    });
    usersTable.addGlobalSecondaryIndex({
      indexName: "RobloxUserIdIndex",
      partitionKey: {
        name: "RobloxUserId",
        type: AttributeType.STRING,
      },
    });

    const googleOAuthClientSecret = Secret.fromSecretNameV2(
      this,
      "GoogleOIDCCredentials",
      "google-oauth-credentials",
    );

    const robloxOAuthClientSecret = Secret.fromSecretNameV2(
      this,
      "RobloxOIDCCredentials",
      "roblox-oauth-credentials",
    );

    this.gallaudet = new Gallaudet(this, "Gallaudet", {
      identityPool: props.identityPool,
      apiSubdomain: "api",
      domainName: props.zone.zoneName,
      websiteDomainName:
        props.stage == "prod"
          ? CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME
          : props.zone.zoneName,
      cognitoAuthorizer: props.cognitoAuthorizer,
      zone: props.zone,
      stage: props.stage,
      oauthTokensTable,
      taskCatalogTable,
      taskInstanceTable: taskInstancesTable,
      experiencesTable,
      projectsTable,
      robloxExperienceApiKeysTable,
      gallaudetApiKeysTable,
      usersTable,
      googleOAuthClientSecret,
      robloxOAuthClientSecret,
      emailIdentity: props.emailIdentity,
      userPool: props.userPool,
    });
  }
}
