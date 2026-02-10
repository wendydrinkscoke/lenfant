import {
  Authorizers,
  CognitoAuthorizer,
  Integrations,
} from "@aws/pdk/type-safe-api";
import { Stack } from "aws-cdk-lib";
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
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { ApiGateway } from "aws-cdk-lib/aws-route53-targets";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { EmailIdentity } from "aws-cdk-lib/aws-ses";
import { Construct } from "constructs";
import {
  Api,
  AttachTaskFunction,
  CatalogTaskFunction,
  CompleteMilestoneFunction,
  DelegateGoogleClassroomAccessFunction,
  DelegateRobloxSecretStoreAccessFunction,
  GetTaskFunction,
  GetTaskCatalogFunction,
  GradeTaskFunction,
  ListTasksForPlayerFunction,
  LinkRobloxAccountFunction,
  PutPartnerFunction,
  GetLinkedRobloxAccountFunction,
  GetGoogleClassroomAccessStatusFunction,
  CreateProjectFunction,
  ListProjectsFunction,
  VendSecretFunction,
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
  readonly taskInstanceTable: ITable;
  readonly partnersTable: ITable;
  readonly projectsTable: ITable;
  readonly robloxExperienceApiKeysTable: ITable;
  readonly usersTable: ITable;
  readonly googleOAuthClientSecret: ISecret;
  readonly robloxOAuthClientSecret: ISecret;
  readonly emailIdentity: EmailIdentity;
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

    const attachTaskFunction = new AttachTaskFunction(
      this,
      "AttachTaskFunction",
      {
        environment: {
          WEBSITE_BASE_URL: `https://${props.websiteDomainName}`,
          GOOGLE_OAUTH_CLIENT_SECRET_ARN:
            props.googleOAuthClientSecret.secretArn,
          OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
          TASK_CATALOG_TABLE_NAME: props.taskCatalogTable.tableName,
          TASK_INSTANCE_TABLE_NAME: props.taskInstanceTable.tableName,
        },
        description: [
          "This function attaches a task, such as a sign-up task or an in-game",
          "task, to a Google classroom item using the Google Classroom API.",
        ].join(" "),
      },
    );
    props.oauthTokensTable.grantReadData(attachTaskFunction);
    props.taskCatalogTable.grantReadData(attachTaskFunction);
    props.taskInstanceTable.grantWriteData(attachTaskFunction);
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

    const completeMilestoneFunction = new CompleteMilestoneFunction(
      this,
      "CompleteMilestoneFunction",
      {
        environment: {
          GOOGLE_OAUTH_CLIENT_SECRET_ARN:
            props.googleOAuthClientSecret.secretArn,
          OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
          TASK_CATALOG_TABLE_NAME: props.taskCatalogTable.tableName,
          TASK_INSTANCE_TABLE_NAME: props.taskInstanceTable.tableName,
          USERS_TABLE_NAME: props.usersTable.tableName,
        },
      },
    );
    props.oauthTokensTable.grantReadData(completeMilestoneFunction);
    props.taskCatalogTable.grantReadData(completeMilestoneFunction);
    props.taskInstanceTable.grantReadWriteData(completeMilestoneFunction);
    props.usersTable.grantReadData(completeMilestoneFunction);
    props.googleOAuthClientSecret.grantRead(completeMilestoneFunction);

    const createProjectFunction = new CreateProjectFunction(
      this,
      "CreateProjectFunction",
      {
        environment: {
          PROJECTS_TABLE_NAME: props.projectsTable.tableName,
        },
      },
    );
    props.projectsTable.grantReadWriteData(createProjectFunction);

    const delegateGoogleClassroomAccessFunction =
      new DelegateGoogleClassroomAccessFunction(
        this,
        "DelegateGoogleClassroomAccessFunction",
        {
          environment: {
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

    const delegateRobloxSecretStoreAccessFunction =
      new DelegateRobloxSecretStoreAccessFunction(
        this,
        "DelegateRobloxSecretStoreAccessFunction",
        {
          environment: {
            ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME:
              props.robloxExperienceApiKeysTable.tableName,
          },
          description: [
            "This function enables access to the Roblox Secret Store",
            "of a particular experience on behalf of a user (a game",
            "developer). This involves receiving an API key from the user",
            "and storing them in a DynamoDB table for later use.",
          ].join(" "),
        },
      );
    props.robloxExperienceApiKeysTable.grantWriteData(
      delegateRobloxSecretStoreAccessFunction,
    );

    const getGoogleClassroomAccessStatusFunction =
      new GetGoogleClassroomAccessStatusFunction(
        this,
        "GetGoogleClassroomAccessStatusFunction",
        {
          environment: {
            OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
          },
          description: [
            "Returns whether the calling user has given us the ability to act on",
            "their behalf while they are offline. That is, whether we've received",
            "a refresh token from the end user or not.",
          ].join(" "),
        },
      );

    props.oauthTokensTable.grantReadData(
      getGoogleClassroomAccessStatusFunction,
    );

    const getLinkedRobloxAccountFunction = new GetLinkedRobloxAccountFunction(
      this,
      "GetLinkedRobloxAccountFunction",
      {
        environment: {
          USERS_TABLE_NAME: props.usersTable.tableName,
        },
        description: [
          "Fetches the Roblox user identifier linked to a specific Cognito user",
          "if a Roblox account has been linked to the user calling the associated",
          "API. The source of truth for this data is the Users DDB table.",
        ].join(" "),
      },
    );
    props.usersTable.grantReadData(getLinkedRobloxAccountFunction);

    const getTaskFunction = new GetTaskFunction(this, "GetTaskFunction", {
      environment: {
        TASK_INSTANCE_TABLE_NAME: props.taskInstanceTable.tableName,
        TASK_CATALOG_TABLE_NAME: props.taskCatalogTable.tableName,
        OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
        PARTNERS_TABLE_NAME: props.partnersTable.tableName,
        GOOGLE_OAUTH_CLIENT_SECRET_ARN: props.googleOAuthClientSecret.secretArn,
      },
      description: [
        "Fetches a task instance record and authorizes the caller against",
        "Google Classroom before returning task instance data.",
      ].join(" "),
    });
    props.taskInstanceTable.grantReadData(getTaskFunction);
    props.taskCatalogTable.grantReadData(getTaskFunction);
    props.oauthTokensTable.grantReadData(getTaskFunction);
    props.partnersTable.grantReadData(getTaskFunction);
    props.googleOAuthClientSecret.grantRead(getTaskFunction);

    const gradeTaskFunction = new GradeTaskFunction(this, "GradeTaskFunction", {
      environment: {
        TASK_INSTANCE_TABLE_NAME: props.taskInstanceTable.tableName,
        OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
        GOOGLE_OAUTH_CLIENT_SECRET_ARN: props.googleOAuthClientSecret.secretArn,
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
      description: [
        "Grades a task instance in Google Classroom on behalf of the",
        "teacher who assigned it.",
      ].join(" "),
    });
    props.taskInstanceTable.grantReadWriteData(gradeTaskFunction);
    props.oauthTokensTable.grantReadData(gradeTaskFunction);
    props.googleOAuthClientSecret.grantRead(gradeTaskFunction);
    props.usersTable.grantReadData(gradeTaskFunction);

    const listTasksForPlayerFunction = new ListTasksForPlayerFunction(
      this,
      "ListTasksForPlayerFunction",
      {
        environment: {
          GOOGLE_OAUTH_CLIENT_SECRET_ARN:
            props.googleOAuthClientSecret.secretArn,
          OAUTH_TOKENS_TABLE_NAME: props.oauthTokensTable.tableName,
          TASK_INSTANCE_TABLE_NAME: props.taskInstanceTable.tableName,
          TASK_CATALOG_TABLE_NAME: props.taskCatalogTable.tableName,
          USERS_TABLE_NAME: props.usersTable.tableName,
        },
        description: [
          "Allows partner game servers to list assignments associated with",
          "a particular Roblox player so in-game experiences can surface",
          "active CivicTech tasks.",
        ].join(" "),
      },
    );
    props.taskInstanceTable.grantReadData(listTasksForPlayerFunction);
    props.taskCatalogTable.grantReadData(listTasksForPlayerFunction);
    props.oauthTokensTable.grantReadData(listTasksForPlayerFunction);
    props.googleOAuthClientSecret.grantRead(listTasksForPlayerFunction);
    props.usersTable.grantReadData(listTasksForPlayerFunction);

    const getTaskCatalogFunction = new GetTaskCatalogFunction(
      this,
      "GetTaskCatalogFunction",
      {
        environment: {
          TASK_CATALOG_TABLE_NAME: props.taskCatalogTable.tableName,
          PARTNERS_TABLE_NAME: props.partnersTable.tableName,
        },
        description: [
          "This function returns the catalog of partner-provided tasks",
          "so classroom UIs can expose the latest assignments teachers",
          "may attach to Google Classroom work.",
        ].join(" "),
      },
    );
    props.taskCatalogTable.grantReadData(getTaskCatalogFunction);
    props.partnersTable.grantReadData(getTaskCatalogFunction);

    const linkRobloxAccountFunction = new LinkRobloxAccountFunction(
      this,
      "LinkRobloxAccountFunction",
      {
        environment: {
          USER_POOL_ID: props.userPool.userPoolId,
          ROBLOX_PROVIDER_NAME: "RobloxOIDC",
          USERS_TABLE_NAME: props.usersTable.tableName,
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
    props.usersTable.grantWriteData(linkRobloxAccountFunction);

    const listProjectsFunction = new ListProjectsFunction(
      this,
      "ListProjectsFunction",
      {
        environment: {
          PROJECTS_TABLE_NAME: props.projectsTable.tableName,
        },
        description: [
          "This function lists all projects created by a particular user.",
          "In the future, we will not care who originally created the project,",
          "but rather we will only care about who currently owns it and who's",
          "been given access via role assignments.",
        ].join(" "),
      },
    );
    props.projectsTable.grantReadData(listProjectsFunction);

    const putPartnerFunction = new PutPartnerFunction(
      this,
      "PutPartnerFunction",
      {
        environment: {
          PARTNERS_TABLE_NAME: props.partnersTable.tableName,
        },
        description: [
          "This function records partner-supplied profile metadata so",
          "the CivicTech platform can display accurate game details to",
          "students and educators.",
        ].join(" "),
      },
    );
    props.partnersTable.grantWriteData(putPartnerFunction);

    const vendSecretFunction = new VendSecretFunction(
      this,
      "VendSecretFunction",
      {
        environment: {
          ROBLOX_EXPERIENCE_API_KEYS_TABLE_NAME:
            props.robloxExperienceApiKeysTable.tableName,
          PARTNER_API_KEY_USAGE_PLAN_NAME: `partner-api-key-usage-plan-${props.stage}`,
          SECRET_DOMAIN: props.websiteDomainName,
        },
        description: [
          "This function vends an API key to access our APIs directly",
          "to partner experiences' game servers using API key based access",
          "to the experience's secret store on Roblox.",
        ].join(" "),
      },
    );
    props.robloxExperienceApiKeysTable.grantReadData(vendSecretFunction);

    this.api = new Api(this, id, {
      apiKeyOptions: {
        source: ApiKeySourceType.HEADER,
      },
      corsOptions: {
        allowOrigins: [`https://${props.websiteDomainName}`],
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
        allowCredentials: true,
      },
      defaultAuthorizer: props.cognitoAuthorizer,
      domainName: {
        domainName: props.apiSubdomain + "." + props.domainName,
        certificate: apiCertificate,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
      integrations: {
        attachTask: {
          integration: Integrations.lambda(attachTaskFunction),
        },
        catalogTask: {
          integration: Integrations.lambda(catalogTaskFunction),
          authorizer: Authorizers.none(),
          options: {
            apiKeyRequired: true,
          },
        },
        completeMilestone: {
          integration: Integrations.lambda(completeMilestoneFunction),
          authorizer: Authorizers.none(),
          options: {
            apiKeyRequired: true,
          },
        },
        createProject: {
          integration: Integrations.lambda(createProjectFunction),
        },
        delegateGoogleClassroomAccess: {
          integration: Integrations.lambda(
            delegateGoogleClassroomAccessFunction,
          ),
        },
        delegateRobloxSecretStoreAccess: {
          integration: Integrations.lambda(
            delegateRobloxSecretStoreAccessFunction,
          ),
        },
        getGoogleClassroomAccessStatus: {
          integration: Integrations.lambda(
            getGoogleClassroomAccessStatusFunction,
          ),
        },
        getLinkedRobloxAccount: {
          integration: Integrations.lambda(getLinkedRobloxAccountFunction),
        },
        getTask: {
          integration: Integrations.lambda(getTaskFunction),
        },
        getTaskCatalog: {
          integration: Integrations.lambda(getTaskCatalogFunction),
        },
        gradeTask: {
          integration: Integrations.lambda(gradeTaskFunction),
          authorizer: Authorizers.none(),
          options: {
            apiKeyRequired: true,
          },
        },
        listProjects: {
          integration: Integrations.lambda(listProjectsFunction),
        },
        listTasksForPlayer: {
          integration: Integrations.lambda(listTasksForPlayerFunction),
          authorizer: Authorizers.none(),
          options: {
            apiKeyRequired: true,
          },
        },
        linkRobloxAccount: {
          integration: Integrations.lambda(linkRobloxAccountFunction),
        },
        putPartner: {
          integration: Integrations.lambda(putPartnerFunction),
          authorizer: Authorizers.none(),
          options: {
            apiKeyRequired: true,
          },
        },
        vendSecret: {
          integration: Integrations.lambda(vendSecretFunction),
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
    });

    new ARecord(scope, "ApiAliasRecord", {
      recordName: props.apiSubdomain + "." + props.domainName,
      target: RecordTarget.fromAlias(new ApiGateway(this.api.api)),
      zone: zone,
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

    const partnerApiKeyUsagePlan = this.api.api.addUsagePlan(
      "PartnerApiKeyUsagePlan",
      {
        name: `partner-api-key-usage-plan-${props.stage}`,
        throttle: {
          burstLimit: 25,
          rateLimit: 10,
        },
      },
    );
    partnerApiKeyUsagePlan.addApiStage({
      stage: this.api.api.deploymentStage,
    });
    vendSecretFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["apigateway:POST", "apigateway:DELETE", "apigateway:GET"],
        resources: [
          `arn:aws:apigateway:${Stack.of(this).region}::/apikeys`,
          `arn:aws:apigateway:${Stack.of(this).region}::/apikeys/*`,
          `arn:aws:apigateway:${Stack.of(this).region}::/usageplans`,
          `arn:aws:apigateway:${Stack.of(this).region}::/usageplans/*`,
          `arn:aws:apigateway:${Stack.of(this).region}::/usageplans/*/keys`,
        ],
      }),
    );

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
            burstLimit: 5,
            rateLimit: 10,
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
