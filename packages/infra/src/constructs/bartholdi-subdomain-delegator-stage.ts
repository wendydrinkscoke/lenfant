import { Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import { BARTHOLDI_ORG_HOSTED_ZONE_NAME } from "../constants";
import { SubdomainDelegatorStack } from "../stacks/subdomain-delegator-stack";
import { BARTHOLDI_STAGES } from "../stages";

interface BartholdiSubdomainDelegatorStageEnvironment {
  readonly account: string;
  readonly region: string;
}

export class BartholdiSubdomainDelegatorStage extends Stage {
  constructor(
    scope: Construct,
    id: string,
    env: BartholdiSubdomainDelegatorStageEnvironment,
  ) {
    super(scope, id);
    console.warn(env);
    const parentZoneName = BARTHOLDI_ORG_HOSTED_ZONE_NAME;
    new SubdomainDelegatorStack(this, "BartholdiSubdomainDelegatorStack", {
      parentZoneName,
      stages: BARTHOLDI_STAGES,
      description: [
        "The purpose of this stack is to create a role, which enables child ",
        "accounts to post records into this account's hosted zone ",
        `${BARTHOLDI_ORG_HOSTED_ZONE_NAME}.`,
        "They can use this role to post records that essentially delegates a ",
        "subdomain to themselves.",
      ].join(" "),
      env: env,
      mode: "BARTHOLDI_STAGES",
    });
  }
}
