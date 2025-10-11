import { ACM, STS, Route53 } from "aws-sdk";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handler(event: any) {
  try {
    if (event.RequestType === "Delete") {
      // TODO: Would be a better practice I think to actually delete the CNAME
      // record, but just ignoring delete events.
      return;
    }

    const { domainNames, parentZoneName, delegatorRoleArn } =
      event.ResourceProperties as {
        domainNames: string[];
        parentZoneName: string;
        delegatorRoleArn: string;
      };

    const acm = new ACM({ region: "us-east-1" });
    const certArn = await findOrWaitForCertificate(
      acm,
      domainNames,
      (Number(process.env.MAX_WAIT_SECONDS) || 600) * 1000,
    );

    const cert = await acm
      .describeCertificate({ CertificateArn: certArn })
      .promise();
    const dvs = cert.Certificate?.DomainValidationOptions ?? [];

    const sts = new STS();
    const { Credentials } = await sts
      .assumeRole({
        RoleArn: delegatorRoleArn,
        RoleSessionName: "acm-xacct-dns",
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

    const apexSuffix = `.${parentZoneName}.`;
    const changes = (dvs || [])
      .filter((v) => v.ResourceRecord?.Name && v.ResourceRecord?.Value)
      .filter((v) => v.ResourceRecord!.Name.endsWith(apexSuffix))
      .map((v) => ({
        Action: "UPSERT" as const,
        ResourceRecordSet: {
          Name: v.ResourceRecord!.Name,
          Type: v.ResourceRecord!.Type!,
          TTL: 300,
          ResourceRecords: [{ Value: v.ResourceRecord!.Value! }],
        },
      }));

    if (changes.length) {
      await route53
        .changeResourceRecordSets({
          HostedZoneId: parentZoneId,
          ChangeBatch: { Changes: changes },
        })
        .promise();
    }
    return;
  } catch (e) {
    console.error("CrossAccountAcmValidation error:", e);
    throw e;
  }
}

async function findOrWaitForCertificate(
  acm: ACM,
  wantedDomains: string[],
  maxWaitMs: number,
): Promise<string> {
  console.log(
    `Finding or waiting for certificate for domains: ${wantedDomains.join(", ")}`,
  );
  const wanted = wantedDomains.map(normalize).sort();
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    // Pull a reasonable page; most envs won't exceed defaults.
    const list = await acm
      .listCertificates({
        CertificateStatuses: ["PENDING_VALIDATION", "ISSUED"],
        Includes: {
          keyTypes: ["RSA_2048", "RSA_4096", "EC_prime256v1", "EC_secp384r1"],
        },
      })
      .promise();
    console.log(
      `ACM ListCertificates response: ${JSON.stringify(list, null, 2)}`,
    );

    const candidates = list.CertificateSummaryList ?? [];
    console.log(`Found ${candidates.length} candidate certificates`);

    // For each candidate, fetch details to check SANs & creation time.
    const detailed = await Promise.all(
      candidates.map(async (c) => {
        if (!c.CertificateArn) return null;
        const d = await acm
          .describeCertificate({ CertificateArn: c.CertificateArn })
          .promise();
        const names = [
          d.Certificate?.DomainName,
          ...(d.Certificate?.SubjectAlternativeNames || []),
        ]
          .filter(Boolean)
          .map(normalize);
        const coversAll = wanted.every((w) => names.includes(w));
        return coversAll
          ? {
              arn: c.CertificateArn!,
              status: d.Certificate?.Status,
              createdAt: d.Certificate?.CreatedAt?.getTime() ?? 0,
            }
          : null;
      }),
    );
    console.log(
      `Detailed certificate info: ${JSON.stringify(detailed, null, 2)}`,
    );

    const matched = (
      detailed.filter(Boolean) as {
        arn: string;
        status?: string;
        createdAt: number;
      }[]
    )
      // prefer PENDING_VALIDATION (i.e., the one we just created), then newest
      .sort((a, b) => {
        const aPending = a.status === "PENDING_VALIDATION" ? 1 : 0;
        const bPending = b.status === "PENDING_VALIDATION" ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return b.createdAt - a.createdAt;
      });
    console.log(`Matched certificates: ${JSON.stringify(matched, null, 2)}`);

    if (matched.length) return matched[0].arn;

    await sleep(5_000);
  }
  throw new Error(
    `Timed out waiting for ACM certificate for domains: ${wantedDomains.join(", ")}`,
  );
}

function normalize(s?: string) {
  return (s || "").trim().replace(/\.$/, "").toLowerCase();
}
