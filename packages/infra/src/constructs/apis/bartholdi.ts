import path from "path";
import {
  Authorizers,
  CognitoAuthorizer,
  CustomAuthorizerType,
  Integrations,
} from "@aws/pdk/type-safe-api";
import { Duration, Fn, SecretValue, Stack } from "aws-cdk-lib";
import { Cors } from "aws-cdk-lib/aws-apigateway";
import { SecurityPolicy } from "aws-cdk-lib/aws-apigatewayv2";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import {
  AnyPrincipal,
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGateway } from "aws-cdk-lib/aws-route53-targets";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
  Api,
  GetCongressInfoFunction,
  NotifyPlayerFunction,
  SaveDeviceTokenFunction,
} from "bartholdi-api-typescript-infra";
import { Construct } from "constructs";

/**
 * Api construct props.
 */
export interface BartholdiProps {
  readonly identityPool: IdentityPool;
  readonly apiSubdomain: string;
  readonly domainName: string;
  readonly cognitoAuthorizer: CognitoAuthorizer;
  readonly zone: HostedZone;
  readonly deviceTokenTable: ITable;
  readonly stage: string;
}

/**
 * Infrastructure construct to deploy a Type Safe API.
 */
export class Bartholdi extends Construct {
  /**
   * API instance
   */
  public readonly api: Api;

  constructor(scope: Construct, id: string, props: BartholdiProps) {
    super(scope, id);
    const zone = props.zone;
    const apiCertificate = new Certificate(scope, "ApiCertificate", {
      domainName: props.apiSubdomain + "." + props.domainName,
      validation: CertificateValidation.fromDns(zone),
    });

    const legislativeApiSecret = new Secret(this, "LegislativeApiSecret", {
      secretName: "legislative-api-key",
      description: [
        "The API key provided by AcidRaps which enables Bartholdi to make",
        "authenticated calls to legislative.civictech.llc. This secret",
        "was created programmatically and edited manually.",
      ].join(" "),
      secretStringValue: SecretValue.unsafePlainText("REPLACE_ME"),
    });

    const getCongressInfoFunction = new GetCongressInfoFunction(
      this,
      "GetCongressInfoFunction",
      {
        environment: {
          LEGISLATIVE_API_SECRET_ARN: legislativeApiSecret.secretArn,
        },
      },
    );

    getCongressInfoFunction.addToRolePolicy(
      PolicyStatement.fromJson({
        Effect: Effect.ALLOW,
        Action: "secretsmanager:GetSecretValue",
        Resource: legislativeApiSecret.secretArn,
      }),
    );

    const saveDeviceTokenFunction = new SaveDeviceTokenFunction(
      this,
      "SaveDeviceTokenFunction",
      {
        environment: {
          DEVICE_TOKEN_TABLE_NAME: props.deviceTokenTable.tableName,
        },
      },
    );

    props.deviceTokenTable.grantWriteData(saveDeviceTokenFunction);

    const apiKeysSecret = new Secret(this, "ApiKeys", {
      secretName: "bartholdi-api-keys",
      description: [
        "A secret containing a comma-separated list of secrets,",
        "which external services, such as the game server, can use to",
        "invoke certain endpoints. This secret was created programmatically",
        "and edited manually.",
      ].join(" "),
      secretStringValue: SecretValue.unsafePlainText("REPLACE_ME,REPLACE_ME"),
    });
    const tokenAuthFn = new NodejsFunction(this, "TokenAuthFn", {
      runtime: Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../apis/key-authorizer/index.ts"),
      handler: "handler",
      environment: {
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
      },
      timeout: Duration.seconds(5),
    });
    apiKeysSecret.grantRead(tokenAuthFn);
    const tokenAuthorizer = Authorizers.custom({
      authorizerId: "APIKeyAuthorizer",
      function: tokenAuthFn,
      type: CustomAuthorizerType.TOKEN,
      identitySource: "method.request.header.Authorization",
      authorizerResultTtlInSeconds: 300,
    });

    const apnsAuthKeySecret = new Secret(this, "APNSAuthKeySecret", {
      secretName: "apns-auth-key-secret",
      description:
        "The auth key generated in the Apple Developer Portal, " +
        "which has APNS as an enabled service. Depending on the stage, " +
        "this key will either be configured as a sandbox or production " +
        "key. This key enables us to create a JWT header to authenticate " +
        "our requests to send push notifications to devices. Although " +
        "the secret was created in code, it's value was replaced manually" +
        "to either be key NM53UD5GKH (prod only) or 2N8LNLRJ7H (sandbox " +
        "only) depending on the stage",
      secretStringValue: SecretValue.unsafePlainText("REPLACE_ME"),
    });

    const userPoolId = Fn.importValue("BartholdiUserPoolId");
    const isApnsSandbox = props.stage == "beta";
    const apnsKeyId = isApnsSandbox ? "2N8LNLRJ7H" : "NM53UD5GKH";
    const notifyPlayerFunction = new NotifyPlayerFunction(
      this,
      "NotifyPlayerFunction",
      {
        environment: {
          APNS_AUTH_KEY_SECRET_ARN: apnsAuthKeySecret.secretArn,
          USER_POOL_ID: userPoolId,
          APNS_KEY_ID: apnsKeyId,
          APNS_TEAM_ID: "REDACTED", // TODO: Add team ID back.
          APNS_ENV: isApnsSandbox ? "sandbox" : "production",
          APNS_TOPIC: "org.bartholdi.NUSA",
        },
      },
    );

    apnsAuthKeySecret.grantRead(notifyPlayerFunction);
    notifyPlayerFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:ListUsers"],
        resources: [
          Stack.of(this).formatArn({
            service: "cognito-idp",
            resource: "userpool",
            resourceName: userPoolId,
          }),
        ],
      }),
    );
    props.deviceTokenTable.grantReadData(notifyPlayerFunction);

    this.api = new Api(this, id, {
      defaultAuthorizer: props.cognitoAuthorizer,
      corsOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
      integrations: {
        getCongressInfo: {
          integration: Integrations.lambda(getCongressInfoFunction),
        },
        saveDeviceToken: {
          integration: Integrations.lambda(saveDeviceTokenFunction),
        },
        notifyPlayer: {
          integration: Integrations.lambda(notifyPlayerFunction),
          authorizer: tokenAuthorizer,
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
