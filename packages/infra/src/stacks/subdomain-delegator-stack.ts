import { Stack, StackProps } from "aws-cdk-lib";
import {
  Role,
  PolicyStatement,
  AccountPrincipal,
  Effect,
  PolicyDocument,
} from "aws-cdk-lib/aws-iam";
import { HostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import {
  GEDU_DEMO_SUBDOMAIN,
  RECORD_UPDATER_ROLE_NAME_PREFIX,
} from "../constants";

interface DomainStage {
  readonly name: string;
  readonly account: string;
  readonly region: string;
}

export interface SubdomainDelegatorStackProps extends StackProps {
  readonly parentZoneName: string;
  readonly stages: DomainStage[];
  readonly mode: "BARTHOLDI_STAGES" | "GEDU" | "GALLAUDET_STAGES";
}

export class SubdomainDelegatorStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SubdomainDelegatorStackProps,
  ) {
    super(scope, id, props);

    const zone = HostedZone.fromLookup(this, "Zone", {
      domainName: props.parentZoneName,
    });

    switch (props.mode) {
      case "BARTHOLDI_STAGES": {
        props.stages.forEach((stage) => {
          this.createCrossAccountDelegationRole(
            zone,
            stage.account,
            `${stage.region}-${stage.name.toLowerCase()}`,
          );
        });
        return;
      }
      case "GEDU": {
        this.createCrossAccountDelegationRole(
          zone,
          props.stages[0].account,
          GEDU_DEMO_SUBDOMAIN,
        );
        return;
      }
      case "GALLAUDET_STAGES": {
        props.stages.forEach((stage) => {
          this.createCrossAccountDelegationRole(
            zone,
            stage.account,
            stage.name.toLowerCase(),
          );
        });
        return;
      }
    }
  }

  createCrossAccountDelegationRole(
    hostedZone: IHostedZone,
    accountId: string,
    subdomain: string,
  ) {
    const editableRecords = [
      `${subdomain}.${hostedZone.zoneName}`,
      `*.${subdomain}.${hostedZone.zoneName}`,
    ];

    if (subdomain === "prod") {
      editableRecords.push(hostedZone.zoneName);
      editableRecords.push(`*.${hostedZone.zoneName}`);
    }

    const dnsUpdaterRole = new Role(this, `DNSUpdateRole-${subdomain}`, {
      roleName: `${RECORD_UPDATER_ROLE_NAME_PREFIX}-${subdomain}`,
      assumedBy: new AccountPrincipal(accountId),
      inlinePolicies: {
        crossAccountPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: "ListHostedZonesByName",
              effect: Effect.ALLOW,
              actions: ["route53:ListHostedZonesByName"],
              resources: ["*"],
            }),
            new PolicyStatement({
              sid: "GetHostedZoneAndChangeResourceRecordSets",
              effect: Effect.ALLOW,
              actions: [
                "route53:GetHostedZone",
                "route53:ChangeResourceRecordSets",
              ],
              resources: [hostedZone.hostedZoneArn],
              conditions: {
                "ForAllValues:StringLike": {
                  "route53:ChangeResourceRecordSetsNormalizedRecordNames":
                    editableRecords,
                },
                "ForAllValues:StringEquals": {
                  "route53:ChangeResourceRecordSetsRecordTypes": [
                    "NS",
                    "CNAME",
                  ],
                },
              },
            }),
            ...(subdomain === "prod"
              ? [
                  new PolicyStatement({
                    sid: "PublishAliasRecord",
                    effect: Effect.ALLOW,
                    actions: ["route53:ChangeResourceRecordSets"],
                    resources: [hostedZone.hostedZoneArn],
                    conditions: {
                      "ForAllValues:StringLike": {
                        "route53:ChangeResourceRecordSetsNormalizedRecordNames":
                          [hostedZone.zoneName],
                      },
                      "ForAllValues:StringEquals": {
                        "route53:ChangeResourceRecordSetsRecordTypes": [
                          "A",
                          "AAAA",
                        ],
                      },
                    },
                  }),
                ]
              : []),
          ],
        }),
      },
    });
    hostedZone.grantDelegation(dnsUpdaterRole);
  }
}
