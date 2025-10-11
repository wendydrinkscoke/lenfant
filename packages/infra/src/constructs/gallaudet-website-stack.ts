import { Stack, StackProps } from "aws-cdk-lib";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { Gallaudet } from "./apis/gallaudet";
import { GallaudetWebsite } from "./websites/gallaudet-website";

interface GallaudetWebsiteStackProps extends StackProps {
  /**
   * Instance of an API to configure the website to integrate with
   */
  readonly gallaudet: Gallaudet;
  readonly identityPoolId: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly cognitoDomainPrefix: string;
  readonly zone: HostedZone;
  readonly isProd: boolean;
  readonly delegationRoleArn: string;
}

export class GallaudetWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props: GallaudetWebsiteStackProps) {
    super(scope, id, props);
    new GallaudetWebsite(this, "GallaudetWebsite", {
      gallaudet: props.gallaudet,
      identityPoolId: props.identityPoolId,
      userPoolId: props.userPoolId,
      userPoolClientId: props.userPoolClientId,
      cognitoDomainPrefix: props.cognitoDomainPrefix,
      childZone: props.zone,
      isProd: props.isProd,
      delegationRoleArn: props.delegationRoleArn,
    });
  }
}
