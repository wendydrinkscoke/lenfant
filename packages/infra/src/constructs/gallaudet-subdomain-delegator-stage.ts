import { Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME } from "../constants";
import { SubdomainDelegatorStack } from "../stacks/subdomain-delegator-stack";
import { GALLAUDET_STAGES } from "../stages";

interface GallaudetSubdomainDelegatorStageEnvironment {
  readonly account: string;
  readonly region: string;
}

export class GallaudetSubdomainDelegatorStage extends Stage {
  constructor(
    scope: Construct,
    id: string,
    env: GallaudetSubdomainDelegatorStageEnvironment,
  ) {
    super(scope, id);
    console.warn(env);
    const parentZoneName = CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME;
    new SubdomainDelegatorStack(this, "GallaudetSubdomainDelegatorStack", {
      parentZoneName,
      stages: GALLAUDET_STAGES,
      description: [
        "The purpose of this stack is to create a role, which enables child",
        "accounts to post records into this account's hosted zone",
        `${CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME}. They can use this role to`,
        "post records that essentially delegates a subdomain to themselves.",
      ].join(" "),
      env: env,
      mode: "GALLAUDET_STAGES",
    });
  }
}
