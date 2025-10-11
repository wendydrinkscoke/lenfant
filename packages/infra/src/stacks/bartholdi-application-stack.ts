import { CognitoAuthorizer } from "@aws/pdk/type-safe-api";
import { Stack, StackProps } from "aws-cdk-lib";
import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { Bartholdi } from "../constructs/apis/bartholdi";

interface BartholdiApplicationStackProps extends StackProps {
  readonly identityPool: IdentityPool;
  readonly cognitoAuthorizer: CognitoAuthorizer;
  readonly zone: HostedZone;
  readonly stage: string;
}

export class BartholdiApplicationStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: BartholdiApplicationStackProps,
  ) {
    super(scope, id, props);

    const deviceTokensTable = new Table(this, "DeviceTokensDDBTable", {
      tableName: "DeviceTokens",
      partitionKey: {
        name: "CognitoUserId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "DeviceId",
        type: AttributeType.STRING,
      },
    });

    new Bartholdi(this, "Bartholdi", {
      identityPool: props.identityPool,
      apiSubdomain: "api",
      domainName: props.zone.zoneName, // e.g. "us-east-1-beta.bartholdi.org"
      cognitoAuthorizer: props.cognitoAuthorizer,
      zone: props.zone,
      deviceTokenTable: deviceTokensTable,
      stage: props.stage,
    });
  }
}
