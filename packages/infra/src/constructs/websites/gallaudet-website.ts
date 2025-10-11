import { StaticWebsite } from "@aws/pdk/static-website";
import { Stack } from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { GeoRestriction } from "aws-cdk-lib/aws-cloudfront";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME } from "../../constants";
import { Gallaudet } from "../apis/gallaudet";
import { CrossAccountAcmValidation } from "../cross-account-acm-validation";
import { CrossAccountAliasRecord } from "../cross-account-alias-record";

export interface GallaudetWebsiteProps {
  /**
   * Instance of an API to configure the website to integrate with
   */
  readonly gallaudet: Gallaudet;
  readonly identityPoolId: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly cognitoDomainPrefix: string;
  readonly childZone: HostedZone;
  readonly isProd: boolean;
  readonly delegationRoleArn: string;
}

export class GallaudetWebsite extends Construct {
  site: StaticWebsite;
  constructor(scope: Construct, id: string, props: GallaudetWebsiteProps) {
    super(scope, id);

    const siteDomain = props.isProd
      ? CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME
      : props.childZone.zoneName;

    const siteCert = new Certificate(this, "SiteCertificate", {
      domainName: siteDomain,
      validation: props.isProd
        ? CertificateValidation.fromDns()
        : CertificateValidation.fromDns(props.childZone),
    });

    props.isProd
      ? new CrossAccountAcmValidation(this, "AcmValidation", {
          domainNames: [CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME],
          parentZoneName: CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME,
          delegatorRoleArn: props.delegationRoleArn,
          entryPath:
            "../infra/src/lambda/cross-account-acm-validation/index.ts",
          maxWaitSeconds: 300,
        })
      : console.log("Validating via DNS, not cross-account ACM.");

    this.site = new StaticWebsite(this, id, {
      websiteContentPath: "../gallaudet-site/build",
      runtimeOptions: {
        jsonPayload: {
          region: Stack.of(this).region,
          identityPoolId: props?.identityPoolId,
          userPoolId: props?.userPoolId,
          cognitoDomainPrefix: props?.cognitoDomainPrefix,
          userPoolWebClientId: props?.userPoolClientId,
          apiBasePath: `https://${props.gallaudet.api.api.domainName!.domainName}`
        },
      },
      distributionProps: {
        domainNames: [siteDomain],
        certificate: siteCert,
        geoRestriction: GeoRestriction.allowlist(
          "AU",
          "ID",
          "IN",
          "JP",
          "KR",
          "SG",
          "US",
        ),
      },
    });
    if (!props.isProd) {
      new ARecord(this, "SiteAliasRecord", {
        target: RecordTarget.fromAlias(
          new CloudFrontTarget(this.site.cloudFrontDistribution),
        ),
        zone: props.childZone,
      });
    } else {
      new CrossAccountAliasRecord(this, "SiteAliasRecord", {
        distributionDomainName: this.site.cloudFrontDistribution.domainName,
        parentZoneName: CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME,
        delegatorRoleArn: props.delegationRoleArn,
        entryPath: "../infra/src/lambda/cross-account-alias-record/index.ts",
      });
    }
  }
}
