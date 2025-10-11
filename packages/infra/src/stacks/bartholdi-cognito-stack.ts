import { Authorizers, CognitoAuthorizer } from "@aws/pdk/type-safe-api";
import { Stack, StackProps, Duration, CfnOutput } from "aws-cdk-lib";
import {
  UserPool,
  UserPoolClient,
  UserPoolIdentityProviderOidc,
  UserPoolClientIdentityProvider,
  ClientAttributes,
  OAuthScope,
  ProviderAttribute,
  StringAttribute,
} from "aws-cdk-lib/aws-cognito";
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from "aws-cdk-lib/aws-cognito-identitypool";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { BARTHOLDI_SERVICE_NAME } from "../constants";

export interface BartholdiCognitoStackProps extends StackProps {
  /** Domain name prefix for the Cognito user pool */
  readonly domainPrefix: string;
  /** Callback URLs for the Cognito user pool client */
  readonly callbackUrls: string[];
}

export class BartholdiCognitoStack extends Stack {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly identityPool: IdentityPool;
  public readonly cognitoAuthorizer: CognitoAuthorizer;

  constructor(scope: Construct, id: string, props: BartholdiCognitoStackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, "BartholdiUserPool", {
      userPoolName: "BartholdiUserPool",
      customAttributes: {
        robloxUserId: new StringAttribute({
          mutable: true,
          minLen: 10,
          maxLen: 10,
        }),
      },
    });

    const secret = Secret.fromSecretNameV2(
      this,
      "RobloxOIDCCredentials",
      "roblox-oauth-credentials",
    );
    const clientId = secret.secretValueFromJson("clientId").unsafeUnwrap();
    const clientSecret = secret
      .secretValueFromJson("clientSecret")
      .unsafeUnwrap();

    const oidcIssuer = "https://apis.roblox.com/oauth/";
    const oidcProvider = new UserPoolIdentityProviderOidc(this, "RobloxOIDC", {
      name: "RobloxOIDC",
      userPool: this.userPool,
      scopes: ["openid", "profile"],
      clientId: clientId,
      clientSecret: clientSecret,
      issuerUrl: oidcIssuer,
      attributeMapping: {
        fullname: ProviderAttribute.other("name"),
        preferredUsername: ProviderAttribute.other("preferred_username"),
        nickname: ProviderAttribute.other("nickname"),
        profilePage: ProviderAttribute.other("profile"),
        profilePicture: ProviderAttribute.other("picture"),
        custom: {
          // Need to explicitly write "custom:"
          // https://github.com/aws/aws-cdk/issues/26820
          "custom:robloxUserId": ProviderAttribute.other("sub"),
        },
      },
    });
    this.userPool.registerIdentityProvider(oidcProvider);

    this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix: props.domainPrefix },
    });

    this.userPoolClient = this.userPool.addClient(
      `${BARTHOLDI_SERVICE_NAME}Client`,
      {
        userPoolClientName: `${BARTHOLDI_SERVICE_NAME}Client`,
        supportedIdentityProviders: [
          UserPoolClientIdentityProvider.custom(oidcProvider.providerName),
        ],
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [
            OAuthScope.OPENID,
            OAuthScope.EMAIL,
            OAuthScope.PHONE,
            OAuthScope.PROFILE,
          ],
          callbackUrls: props.callbackUrls,
        },
        refreshTokenValidity: Duration.days(3),
        accessTokenValidity: Duration.hours(20),
        idTokenValidity: Duration.hours(20),
        readAttributes: new ClientAttributes().withStandardAttributes({
          email: true,
          familyName: true,
          givenName: true,
          profilePage: true,
        }),
      },
    );
    this.userPoolClient.node.addDependency(oidcProvider);

    this.identityPool = new IdentityPool(
      this,
      `${BARTHOLDI_SERVICE_NAME}IdentityPool`,
      {
        identityPoolName: `${BARTHOLDI_SERVICE_NAME}IdentityPool`,
        allowUnauthenticatedIdentities: false,
        allowClassicFlow: true,
        authenticationProviders: {
          userPools: [
            new UserPoolAuthenticationProvider({
              userPool: this.userPool,
              userPoolClient: this.userPoolClient,
            }),
          ],
        },
      },
    );

    this.cognitoAuthorizer = Authorizers.cognito({
      authorizerId: "CognitoAuthorizer",
      userPools: [this.userPool],
    });

    new CfnOutput(this, "UserPoolIdExport", {
      value: this.userPool.userPoolId,
      exportName: "BartholdiUserPoolId",
    });
  }
}
