import { Duration, CustomResource } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface CrossAccountAliasRecordProps {
  entryPath: string;
  delegatorRoleArn: string;
  distributionDomainName: string;
  parentZoneName: string;
}

export class CrossAccountAliasRecord extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: CrossAccountAliasRecordProps,
  ) {
    super(scope, id);

    const fn = new lambdaNode.NodejsFunction(this, "Handler", {
      entry: props.entryPath,
      handler: "handler",
      timeout: Duration.minutes(15),
    });

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [props.delegatorRoleArn],
      }),
    );

    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: fn,
      logRetention: 7,
    });

    new CustomResource(this, "Resource", {
      serviceToken: provider.serviceToken,
      properties: {
        delegatorRoleArn: props.delegatorRoleArn,
        distributionDomainName: props.distributionDomainName,
        parentZoneName: props.parentZoneName,
      },
    });
  }
}
