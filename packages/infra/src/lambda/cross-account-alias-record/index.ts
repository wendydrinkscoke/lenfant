import { STS, Route53 } from "aws-sdk";
import { CLOUDFRONT_HOSTED_ZONE_ID } from "../../constants";

export async function handler(event: any) {
  if (event.RequestType === "Delete") {
    return;
  }

  const { delegatorRoleArn, parentZoneName, distributionDomainName } =
    event.ResourceProperties as {
      delegatorRoleArn: string;
      parentZoneName: string;
      distributionDomainName: string;
    };
  const sts = new STS();
  const { Credentials } = await sts
    .assumeRole({
      RoleArn: delegatorRoleArn,
      RoleSessionName: "cfrnt-xacct-dns",
      DurationSeconds: 900,
    })
    .promise();
  const route53 = new Route53({
    accessKeyId: Credentials!.AccessKeyId,
    secretAccessKey: Credentials!.SecretAccessKey,
    sessionToken: Credentials!.SessionToken,
  });
  const hz = await route53
    .listHostedZonesByName({ DNSName: parentZoneName })
    .promise();
  const target = (hz.HostedZones || []).find(
    (z) => z.Name === `${parentZoneName}.` && !z.Config?.PrivateZone,
  );
  if (!target?.Id)
    throw new Error(`Parent hosted zone not found for ${parentZoneName}`);
  const parentZoneId = target.Id.replace(/^\/hostedzone\//, "");
  const recordTypes = ["A", "AAAA"] as const;
  const changes: Route53.Change[] = recordTypes.map((Type) => ({
    Action: "UPSERT",
    ResourceRecordSet: {
      Name: parentZoneName,
      Type,
      AliasTarget: {
        HostedZoneId: CLOUDFRONT_HOSTED_ZONE_ID,
        DNSName: distributionDomainName,
        EvaluateTargetHealth: false,
      },
    },
  }));
  await route53
    .changeResourceRecordSets({
      HostedZoneId: parentZoneId,
      ChangeBatch: {
        Comment: "Add/Update A and AAAA aliases for CloudFront",
        Changes: changes,
      },
    })
    .promise();
}
