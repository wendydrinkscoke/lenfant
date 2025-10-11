import { CognitoAuthorizer } from "@aws/pdk/type-safe-api";
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Key, KeySpec, KeyUsage } from "aws-cdk-lib/aws-kms";
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
        name: "TenantId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "EntryId",
        type: AttributeType.STRING,
      },
    });

    const googleOAuthClientSecret = Secret.fromSecretNameV2(
      this,
      "GoogleOIDCCredentials",
      "google-oauth-credentials",
    );

    const invitationLinkJwtSigningKey = new Key(this, "JwtSigningKey", {
      description:
        "Asymmetric RSA key for signing/verifying JWTs in " +
        "invitation links",
      keySpec: KeySpec.RSA_2048,
      keyUsage: KeyUsage.SIGN_VERIFY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

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
      googleOAuthClientSecret,
      emailIdentity: props.emailIdentity,
      invitationLinkJwtSigningKey,
      userPool: props.userPool,
    });
  }
}
