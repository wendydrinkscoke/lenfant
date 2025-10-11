import { Authorizers, CognitoAuthorizer } from "@aws/pdk/type-safe-api";
import { Stack, StackProps, Duration } from "aws-cdk-lib";
import {
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  ClientAttributes,
  OAuthScope,
  UserPoolIdentityProviderGoogle,
  ProviderAttribute,
  UserPoolIdentityProviderOidc,
  StringAttribute,
} from "aws-cdk-lib/aws-cognito";
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from "aws-cdk-lib/aws-cognito-identitypool";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { GALLAUDET_SERVICE_NAME } from "../constants";

export interface GallaudetCognitoStackProps extends StackProps {
  /** Domain name prefix for the Cognito user pool */
  readonly domainPrefix: string;
  /** Callback URLs for the Cognito user pool client */
  readonly callbackUrls: string[];
}

export class GallaudetCognitoStack extends Stack {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly identityPool: IdentityPool;
  public readonly cognitoAuthorizer: CognitoAuthorizer;

  constructor(scope: Construct, id: string, props: GallaudetCognitoStackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, "GallaudetUserPool", {
      userPoolName: "GallaudetUserPool",
      customAttributes: {
        robloxUserId: new StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 32,
        }),
      },
    });

    const secret = Secret.fromSecretNameV2(
      this,
      "GoogleOIDCCredentials",
      "google-oauth-credentials",
    );

    const googleOAuthClientID = secret
      .secretValueFromJson("clientId")
      .unsafeUnwrap();
    const googleOAuthClientSecret = secret
      .secretValueFromJson("clientSecret")
      .unsafeUnwrap();

    const robloxSecret = Secret.fromSecretNameV2(
      this,
      "RobloxOIDCCredentials",
      "roblox-oauth-credentials",
    );
    const robloxClientId = robloxSecret
      .secretValueFromJson("clientId")
      .unsafeUnwrap();
    const robloxClientSecret = robloxSecret
      .secretValueFromJson("clientSecret")
      .unsafeUnwrap();

    const oidcProvider = new UserPoolIdentityProviderGoogle(
      this,
      "GoogleOIDC",
      {
        userPool: this.userPool,
        clientId: googleOAuthClientID,
        clientSecret: googleOAuthClientSecret,
        scopes: ["email", "profile"],
        attributeMapping: {
          givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: ProviderAttribute.GOOGLE_PICTURE,
          email: ProviderAttribute.GOOGLE_EMAIL,
        },
      },
    );
    this.userPool.registerIdentityProvider(oidcProvider);

    const robloxOidcProvider = new UserPoolIdentityProviderOidc(
      this,
      "RobloxOIDC",
      {
        name: "RobloxOIDC",
        userPool: this.userPool,
        clientId: robloxClientId,
        clientSecret: robloxClientSecret,
        issuerUrl: "https://apis.roblox.com/oauth/",
        scopes: ["openid", "profile"],
        attributeMapping: {
          fullname: ProviderAttribute.other("name"),
          preferredUsername: ProviderAttribute.other("preferred_username"),
          nickname: ProviderAttribute.other("nickname"),
          profilePage: ProviderAttribute.other("profile"),
          custom: {
            "custom:robloxUserId": ProviderAttribute.other("sub"),
          },
        },
      },
    );
    this.userPool.registerIdentityProvider(robloxOidcProvider);

    this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix: props.domainPrefix },
    });

    const readAttributes = new ClientAttributes()
      .withStandardAttributes({
        email: true,
        familyName: true,
        givenName: true,
        profilePage: true,
      })
      .withCustomAttributes("custom:robloxUserId");

    const writeAttributes = new ClientAttributes().withCustomAttributes(
      "custom:robloxUserId",
    );

    this.userPoolClient = this.userPool.addClient(
      `${GALLAUDET_SERVICE_NAME}Client`,
      {
        userPoolClientName: `${GALLAUDET_SERVICE_NAME}Client`,
        supportedIdentityProviders: [
          UserPoolClientIdentityProvider.GOOGLE,
          UserPoolClientIdentityProvider.custom(
            robloxOidcProvider.providerName,
          ),
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
        readAttributes,
        writeAttributes,
      },
    );
    this.userPoolClient.node.addDependency(oidcProvider);
    this.userPoolClient.node.addDependency(robloxOidcProvider);

    this.identityPool = new IdentityPool(
      this,
      `${GALLAUDET_SERVICE_NAME}IdentityPool`,
      {
        identityPoolName: `${GALLAUDET_SERVICE_NAME}IdentityPool`,
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
  }
}
