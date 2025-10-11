import { Stack } from "aws-cdk-lib";
import { IPublicHostedZone } from "aws-cdk-lib/aws-route53";
import {
  EmailIdentity,
  Identity,
  MailFromBehaviorOnMxFailure,
  VdmAttributes,
} from "aws-cdk-lib/aws-ses";
import { Construct } from "constructs";

export interface GallaudetEmailStackProps {
  zone: IPublicHostedZone;
  stage: "beta" | "gamma" | "prod";
}

// Email stack to send sign up invitations to student emails shared by a
// teacher.
//
// See: https://shorturl.at/sLFfw
export class GallaudetEmailStack extends Stack {
  emailIdentity: EmailIdentity;

  constructor(scope: Construct, id: string, props: GallaudetEmailStackProps) {
    super(scope, id);

    this.emailIdentity = new EmailIdentity(this, "EmailIdentity", {
      identity: Identity.publicHostedZone(props.zone),
      dkimSigning: true,
      mailFromDomain: `mail.${props.zone.zoneName}`,
      mailFromBehaviorOnMxFailure:
        MailFromBehaviorOnMxFailure.USE_DEFAULT_VALUE,
    });

    // Enable VDM at the account level. VDM provides visibility into email
    // sending metrics.
    new VdmAttributes(this, "Vdm");
  }
}
