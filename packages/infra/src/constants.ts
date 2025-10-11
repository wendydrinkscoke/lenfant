export const GALLAUDET_SERVICE_NAME = "Gallaudet";
export const BARTHOLDI_SERVICE_NAME = "Bartholdi";

// MARK: - Prerequisites

// A prerequisite for deploying this construct is to have a Route53
// hosted zone for the domain name.
export const BARTHOLDI_ORG_HOSTED_ZONE_NAME = "bartholdi.org";
export const CIVICTECH_DOMAIN = "civictech.llc";
export const CIVICTECH_FOR_SCHOOLS_HOSTED_ZONE_NAME = "school.civictech.llc";
export const GEDU_DEMO_SUBDOMAIN = "gedu.demo";
export const GEDU_FQDN = "gedu.demo.civictech.llc";

export const REPO = "wendydrinkscoke/lenfant";
export const PIPELINE_ACCOUNT_CODE_CONNECTION_ARN =
  "arn:aws:codeconnections:us-east-1:115690362259:connection/bc64b2a2-8f0a-471a-873f-0df5064a58a2";

// The name of the role which child accounts can use to post NS
// records into the management account's hosted zone. This action
// is what makes it valid for the child account to claim the sub-
// domain.
export const RECORD_UPDATER_ROLE_NAME_PREFIX = "RecordUpdaterRole";
export const MANAGEMENT_ACCOUNT_ID = "115690362259";
export const MANAGEMENT_REGION = "us-east-1";

// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53.CfnRecordSet.AliasTargetProperty.html#hostedzoneid
export const CLOUDFRONT_HOSTED_ZONE_ID = "Z2FDTNDATAQYW2";
