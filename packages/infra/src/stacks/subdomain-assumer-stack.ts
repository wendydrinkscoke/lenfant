import { Stack, StackProps } from "aws-cdk-lib";
import { Role } from "aws-cdk-lib/aws-iam";
import {
  CrossAccountZoneDelegationRecord,
  HostedZone,
  PublicHostedZone,
} from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface SubdomainAssumerStackProps extends StackProps {
  readonly parentZoneName: string; // e.g. "bartholdi.org"
  readonly delegationRoleArn: string; // from management account output
  readonly subdomain: string; // e.g. "us-east-1-gamma"
}

export class SubdomainAssumerStack extends Stack {
  public readonly childHostedZone: HostedZone | null = null;

  constructor(scope: Construct, id: string, props: SubdomainAssumerStackProps) {
    super(scope, id, props);

    // 1. Create the child hosted zone, e.g. stage.example.com
    const fullyQualifiedSubdomain = `${props.subdomain}.${props.parentZoneName}`;
    const childHostedZone = new PublicHostedZone(this, "ChildHostedZone", {
      zoneName: fullyQualifiedSubdomain,
    });
    this.childHostedZone = childHostedZone;
    new CrossAccountZoneDelegationRecord(
      this,
      "CrossAccountZoneDelegationRecord",
      {
        delegatedZone: childHostedZone,
        parentHostedZoneName: props.parentZoneName,
        delegationRole: Role.fromRoleArn(
          this,
          "DelegationRole",
          props.delegationRoleArn,
        ),
      },
    );
  }
}
