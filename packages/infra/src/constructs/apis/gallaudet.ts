import { CognitoAuthorizer, Integrations } from "@aws/pdk/type-safe-api";
import { Cors } from "aws-cdk-lib/aws-apigateway";
import { SecurityPolicy } from "aws-cdk-lib/aws-apigatewayv2";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { ITable } from "aws-cdk-lib/aws-dynamodb/lib/shared";
import {
  AnyPrincipal,
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { IKey } from "aws-cdk-lib/aws-kms/lib/key";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGateway } from "aws-cdk-lib/aws-route53-targets";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { EmailIdentity } from "aws-cdk-lib/aws-ses";
import { Construct } from "constructs";
import {
  Api,
  AttachTaskFunction,
  DelegateGoogleClassroomAccessFunction,
  LinkRobloxAccountFunction,
} from "gallaudet-api-typescript-infra";

/**
 * Api construct props.
 */
export interface GallaudetProps {
  readonly identityPool: IdentityPool;
  readonly apiSubdomain: string;
  readonly domainName: string;
  readonly websiteDomainName: string;
  readonly cognitoAuthorizer: CognitoAuthorizer;
  readonly zone: HostedZone;
  readonly stage: string;
  readonly oauthTokensTable: ITable;
  readonly googleOAuthClientSecret: ISecret;
  readonly emailIdentity: EmailIdentity;
  readonly invitationLinkJwtSigningKey: IKey;
  readonly userPool: UserPool;
}

/**
 * Infrastructure construct to deploy a Type Safe API.
 */
export class Gallaudet extends Construct {
  /**
   * API instance
   */
  public readonly api: Api;

  constructor(scope: Construct, id: string, props: GallaudetProps) {
    super(scope, id);
    const zone = props.zone;
    const apiCertificate = new Certificate(scope, "ApiCertificate", {
      domainName: props.apiSubdomain + "." + props.domainName,
      validation: CertificateValidation.fromDns(zone),
    });

    const delegateGoogleClassroomAccessFunction =
      new DelegateGoogleClassroomAccessFunction(
        this,
        "DelegateGoogleClassroomAccessFunction",
        {
          environment: {
            OAUTH_TOKENS_TABLE_ARN: props.oauthTokensTable.tableArn,
            OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
            GOOGLE_OAUTH_CLIENT_SECRET_ARN:
              props.googleOAuthClientSecret.secretArn,
          },
        },
      );
    props.oauthTokensTable.grantWriteData(
      delegateGoogleClassroomAccessFunction,
    );
    props.googleOAuthClientSecret.grantRead(
      delegateGoogleClassroomAccessFunction,
    );

    const attachTaskFunction = new AttachTaskFunction(
      this,
      "AttachTaskFunction",
      {
        environment: {
          WEBSITE_BASE_URL: `https://${props.websiteDomainName}`,
          GOOGLE_OAUTH_CLIENT_SECRET_ARN:
            props.googleOAuthClientSecret.secretArn,
          OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
        },
      },
    );
    props.oauthTokensTable.grantReadData(attachTaskFunction);
    props.googleOAuthClientSecret.grantRead(attachTaskFunction);

    const linkRobloxAccountFunction = new LinkRobloxAccountFunction(
      this,
      "LinkRobloxAccountFunction",
      {
        environment: {
          USER_POOL_ID: props.userPool.userPoolId,
          ROBLOX_PROVIDER_NAME: "RobloxOIDC",
        },
      },
    );
    linkRobloxAccountFunction.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminLinkProviderForUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminDeleteUser",
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    this.api = new Api(this, id, {
      defaultAuthorizer: props.cognitoAuthorizer,
      corsOptions: {
        allowOrigins: [`https://${props.websiteDomainName}`],
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
        allowCredentials: true,
      },
      integrations: {
        delegateGoogleClassroomAccess: {
          integration: Integrations.lambda(
            delegateGoogleClassroomAccessFunction,
          ),
        },
        attachTask: {
          integration: Integrations.lambda(attachTaskFunction),
        },
        linkRobloxAccount: {
          integration: Integrations.lambda(linkRobloxAccountFunction),
        },
      },
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ["execute-api:Invoke"],
            resources: ["execute-api:/*"],
          }),
        ],
      }),
      domainName: {
        domainName: props.apiSubdomain + "." + props.domainName,
        certificate: apiCertificate,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
    });

    new ARecord(scope, "ApiAliasRecord", {
      target: RecordTarget.fromAlias(new ApiGateway(this.api.api)),
      zone: zone,
      recordName: props.apiSubdomain + "." + props.domainName,
    });

    // Grant authenticated users access to invoke the api
    new Policy(this, "InvokeApiPolicy", {
      roles: [props.identityPool.authenticatedRole],
      statements: [
        new PolicyStatement({
          actions: ["execute-api:Invoke"],
          resources: [this.api.api.arnForExecuteApi("*", "/*", "*")],
        }),
      ],
    });
  }
}
