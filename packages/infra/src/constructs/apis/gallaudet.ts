import {
  Authorizers,
  CognitoAuthorizer,
  Integrations,
} from "@aws/pdk/type-safe-api";
import { ApiKeySourceType, Cors } from "aws-cdk-lib/aws-apigateway";
import { SecurityPolicy } from "aws-cdk-lib/aws-apigatewayv2";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
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
  CatalogTaskFunction,
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
  readonly taskCatalogTable: ITable;
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
          description: [
            'This function "delegates" access to a Google Classroom on',
            "behalf of a user using. What this really entails is receiving",
            "their OAuth token and storing it in a DynamoDB table for later",
            "use.",
          ].join(" "),
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
        description: [
          "This function attaches a task, such as a sign-up task or an in-game",
          "task, to a Google classroom item using the Google Classroom API.",
        ].join(" "),
      },
    );
    props.oauthTokensTable.grantReadData(attachTaskFunction);
    props.googleOAuthClientSecret.grantRead(attachTaskFunction);

    const catalogTaskFunction = new CatalogTaskFunction(
      this,
      "CatalogTaskFunction",
      {
        environment: {
          TASK_CATALOG_TABLE_NAME: props.taskCatalogTable.tableName,
        },
        description: [
          "This function lets partner game servers create or update task",
          "catalog entries that teachers can later assign in Classroom.",
        ].join(" "),
      },
    );
    props.taskCatalogTable.grantWriteData(catalogTaskFunction);

    const linkRobloxAccountFunction = new LinkRobloxAccountFunction(
      this,
      "LinkRobloxAccountFunction",
      {
        environment: {
          USER_POOL_ID: props.userPool.userPoolId,
          ROBLOX_PROVIDER_NAME: "RobloxOIDC",
        },
        description: [
          "This function links a user's Cognito account to their Roblox",
          "account using Cognito's AdminLinkProviderForUser API.",
        ].join(" "),
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
      apiKeyOptions: {
        source: ApiKeySourceType.HEADER,
      },
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
        catalogTask: {
          integration: Integrations.lambda(catalogTaskFunction),
          authorizer: Authorizers.none(),
          options: {
            apiKeyRequired: true,
          },
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

    if (props.stage !== "prod") {
      const postmanApiKey = this.api.api.addApiKey("PostmanTestingApiKey", {
        apiKeyName: `postman-${props.stage}`,
        description:
          "Manual testing key for invoking catalog endpoints via Postman",
      });

      const postmanUsagePlan = this.api.api.addUsagePlan(
        "PostmanTestingUsagePlan",
        {
          name: `postman-testing-${props.stage}`,
          throttle: {
            rateLimit: 10,
            burstLimit: 5,
          },
        },
      );
      postmanUsagePlan.addApiStage({
        stage: this.api.api.deploymentStage,
      });
      postmanUsagePlan.addApiKey(postmanApiKey);
    }
  }
}
