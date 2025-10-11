import { Stack, StackProps, Stage } from "aws-cdk-lib";
import { HostedZone, MxRecord, TxtRecord } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { GEDU_FQDN } from "../constants";
import { GOOGLE_EDU_DEMO_STAGE } from "../stages";

export class GoogleEduSubdomainOwnershipStage extends Stage {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new GoogleEduSubdomainOwnershipStack(
      this,
      "GoogleEduSubdomainOwnershipStack",
      {
        env: {
          region: "us-east-1",
          account: GOOGLE_EDU_DEMO_STAGE.account,
        },
      },
    );
  }
}

// Proves we own the gedu.demo.civictech.llc domain. It also tells mail
// senders to deliver mail for this domain to Google/Gmail via an MX record.
class GoogleEduSubdomainOwnershipStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const zone = HostedZone.fromLookup(this, "GeduDemoZone", {
      domainName: GEDU_FQDN,
    });

    // - packages/infra/documentation-assets/workspace-verification-artifact-1.png
    // - packages/infra/documentation-assets/workspace-verification-artifact-2.png
    // - packages/infra/documentation-assets/workspace-verification-artifact-3.png
    new TxtRecord(this, "ProveDomainOwnershipTxtRecord", {
      zone,
      values: [
        "google-site-verification=ObchH_7efhOClPLnSHCwPJXv2fi9kOv-LuV4FdGma0k",
      ],
    });

    // - packages/infra/documentation-assets/workspace-verification-artifact-4.png
    // - packages/infra/documentation-assets/workspace-verification-artifact-5.png
    new MxRecord(this, "GoogleMxVerificationRecord", {
      zone,
      values: [
        {
          hostName: "SMTP.GOOGLE.COM",
          priority: 1,
        },
      ],
    });
  }
}
