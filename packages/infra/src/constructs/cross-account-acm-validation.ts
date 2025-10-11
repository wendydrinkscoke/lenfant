import { Duration, CustomResource } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface CrossAccountAcmValidationProps {
  domainNames: string[];
  parentZoneName: string;
  delegatorRoleArn: string;
  entryPath?: string;
  maxWaitSeconds?: number;
}

export class CrossAccountAcmValidation extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: CrossAccountAcmValidationProps,
  ) {
    super(scope, id);

    const fn = new lambdaNode.NodejsFunction(this, "Handler", {
      entry: props.entryPath,
      handler: "handler",
      timeout: Duration.minutes(15),
      environment: {
        MAX_WAIT_SECONDS: String(props.maxWaitSeconds ?? 300),
      },
    });

    fn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "acm:ListCertificates",
          "acm:DescribeCertificate",
          "acm:ListTagsForCertificate",
        ],
        resources: ["*"],
      }),
    );

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
        domainNames: props.domainNames,
        parentZoneName: props.parentZoneName,
        delegatorRoleArn: props.delegatorRoleArn,
      },
    });
  }
}
