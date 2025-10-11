import { App, Stack, StackProps } from "aws-cdk-lib";
import { CfnGroup as IdentityStoreGroup } from "aws-cdk-lib/aws-identitystore";
import { CfnAccount } from "aws-cdk-lib/aws-organizations";
import { CfnPermissionSet, CfnAssignment } from "aws-cdk-lib/aws-sso";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";

// Note: If the management account is a newly-created account, it will
// require a quote increase for the number of accounts it can create.
// This is because new accounts are subject to a limit which is lower
// than the default of 10.
//
// https://shorturl.at/yQJOP
export class ManagementStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // new CfnOrganization(this, "Org", {
    //   featureSet: "ALL",
    // });

    const betaGallaudet = new CfnAccount(this, "GallaudetBetaAccount", {
      accountName: "gallaudet-service-beta",
      email: "cupwendyscup+beta-gallaudet-service@gmail.com",
      roleName: "OrganizationAccountAccessRole",
    });

    const gammaGallaudet = new CfnAccount(this, "GallaudetGammaAccount", {
      accountName: "gallaudet-service-gamma",
      email: "cupwendyscup+gamma-gallaudet-service@gmail.com",
      roleName: "OrganizationAccountAccessRole",
    });

    const prodGallaudet = new CfnAccount(this, "GallaudetProdAccount", {
      accountName: "gallaudet-service-prod",
      email: "cupwendyscup+prod-gallaudet-service@gmail.com",
      roleName: "OrganizationAccountAccessRole",
    });

    const betaBartholdi = new CfnAccount(this, "BartholdiBetaAccount", {
      accountName: "bartholdi-service-beta",
      email: "cupwendyscup+beta-service@gmail.com",
      roleName: "OrganizationAccountAccessRole",
    });

    const gammaBartholdi = new CfnAccount(this, "BartholdiGammaAccount", {
      accountName: "bartholdi-service-gamma",
      email: "cupwendyscup+gamma-service@gmail.com",
      roleName: "OrganizationAccountAccessRole",
    });

    const prodBartholdi = new CfnAccount(this, "BartholdiProdAccount", {
      accountName: "bartholdi-service-prod",
      email: "cupwendyscup+prod-service@gmail.com",
      roleName: "OrganizationAccountAccessRole",
    });

    // Discover the existing IAM Identity Center (SSO) instance.
    //
    // Note: I enabled IAM identity center manually via the AWS Management Console. This
    // is the reason we have to use a custom resource to glean its ARN/ID. The reason
    // I created it manually via the console is AWS does not support enabling IAM Identity
    // Center via CDK.
    //
    // https://shorturl.at/SKT1K
    const listInstances = new AwsCustomResource(
      this,
      "ListIdentityCenterInstances",
      {
        onUpdate: {
          service: "SSOAdmin",
          action: "listInstances",
          parameters: {},
          physicalResourceId: PhysicalResourceId.of("identity-center-instance"),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      },
    );

    const instanceArn = listInstances.getResponseField(
      "Instances.0.InstanceArn",
    ) as string;
    const identityStoreId = listInstances.getResponseField(
      "Instances.0.IdentityStoreId",
    ) as string;

    // 2. Create the centralized "Engineers" group in the Identity Store.
    const engineersGroup = new IdentityStoreGroup(
      this,
      "EngineersIdentityStoreGroup",
      {
        identityStoreId: identityStoreId,
        displayName: "Engineers",
        description: "Central engineers group for cross-account access",
      },
    );

    const lenfantAdminsGroup = new IdentityStoreGroup(
      this,
      "LenfantAdminsIdentityStoreGroup",
      {
        identityStoreId: identityStoreId,
        displayName: "LenfantAdmins",
        description: "Administrative access to management and project accounts",
      },
    );

    // 3-a. Enable the Engineers group to read the CodePipeline in this account.
    const pipelineReadOnlyPs = new CfnPermissionSet(
      this,
      "PipelineReadOnlyPS",
      {
        instanceArn,
        name: "CodePipelineReader",
        description: "Read-only access to CodePipeline in management account",
        managedPolicies: [
          "arn:aws:iam::aws:policy/AWSCodePipeline_ReadOnlyAccess",
        ],
        sessionDuration: "PT4H",
      },
    );

    new CfnAssignment(this, "AssignPipelineReadOnly", {
      instanceArn,
      permissionSetArn: pipelineReadOnlyPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: this.account,
    });

    // 3-b. Enable engineers to administer beta accounts.
    const adminPs = new CfnPermissionSet(this, "AdminPS", {
      instanceArn,
      name: "Administrator",
      description: "Full administrator access",
      managedPolicies: ["arn:aws:iam::aws:policy/AdministratorAccess"],
      sessionDuration: "PT8H",
    });

    new CfnAssignment(this, "AssignBetaBartholdiAdmin", {
      instanceArn,
      permissionSetArn: adminPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: betaBartholdi.ref,
    });

    new CfnAssignment(this, "AssignBetaGallaudetAdmin", {
      instanceArn,
      permissionSetArn: adminPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: betaGallaudet.ref,
    });

    const lenfantAdminTargets = [
      { suffix: "Management", targetId: this.account },
      { suffix: "GallaudetBeta", targetId: betaGallaudet.ref },
      { suffix: "GallaudetGamma", targetId: gammaGallaudet.ref },
      { suffix: "GallaudetProd", targetId: prodGallaudet.ref },
      { suffix: "BartholdiBeta", targetId: betaBartholdi.ref },
      { suffix: "BartholdiGamma", targetId: gammaBartholdi.ref },
      { suffix: "BartholdiProd", targetId: prodBartholdi.ref },
    ];

    for (const { suffix, targetId } of lenfantAdminTargets) {
      new CfnAssignment(this, `LenfantAdmins${suffix}Admin`, {
        instanceArn,
        permissionSetArn: adminPs.attrPermissionSetArn,
        principalType: "GROUP",
        principalId: lenfantAdminsGroup.attrGroupId,
        targetType: "AWS_ACCOUNT",
        targetId,
      });
    }

    // 3-c. Enable engineers to bootstrap the stages.
    // By bootstrapping, I mean completing any manual actions that are required
    // to get the first pipeline push to succeed. For now, the only manual action
    // that is required is to create the Google OAuth secret.
    const googleSecretName = "google-oauth-credentials";
    const googleSecretArnPattern = `arn:aws:secretsmanager:*:*:secret:${googleSecretName}*`;

    const bootstrapperInlinePolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "CreateGoogleOauthSecretByNameOnly",
          Effect: "Allow",
          Action: ["secretsmanager:CreateSecret"],
          Resource: "*",
          Condition: {
            StringEquals: { "secretsmanager:Name": googleSecretName },
          },
        },
        {
          Sid: "WriteWithoutReadForGoogleOauthSecret",
          Effect: "Allow",
          Action: [
            "secretsmanager:PutSecretValue",
            "secretsmanager:UpdateSecret",
            "secretsmanager:TagResource",
            "secretsmanager:UntagResource",
            "secretsmanager:ListSecrets",
            "secretsmanager:DescribeSecret",
          ],
          Resource: googleSecretArnPattern,
        },
      ],
    };

    const bootstrapperPs = new CfnPermissionSet(this, "BootstrapperPS", {
      instanceArn,
      name: "Bootstrapper",
      description: "Write-only permissions for google-oauth-credentials",
      inlinePolicy: bootstrapperInlinePolicy,
      sessionDuration: "PT8H",
    });

    new CfnAssignment(this, "Bootstrapper-Gallaudet-Beta", {
      instanceArn,
      permissionSetArn: bootstrapperPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: betaGallaudet.ref,
    });

    new CfnAssignment(this, "Bootstrapper-Gallaudet-Gamma", {
      instanceArn,
      permissionSetArn: bootstrapperPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: gammaGallaudet.ref,
    });

    new CfnAssignment(this, "Bootstrapper-Gallaudet-Prod", {
      instanceArn,
      permissionSetArn: bootstrapperPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: prodGallaudet.ref,
    });

    // 3-d. Grant engineers ViewOnly access.
    const viewOnlyPs = new CfnPermissionSet(this, "ViewOnlyPS", {
      instanceArn,
      name: "Viewer",
      description: "Access to view/list resource metadata",
      managedPolicies: [
        "arn:aws:iam::aws:policy/job-function/ViewOnlyAccess",
        "arn:aws:iam::aws:policy/AWSCloudFormationReadOnlyAccess",
      ],
      sessionDuration: "PT4H",
    });

    new CfnAssignment(this, "ViewOnly-Gallaudet-Beta", {
      instanceArn,
      permissionSetArn: viewOnlyPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: betaGallaudet.ref,
    });

    new CfnAssignment(this, "ViewOnly-Gallaudet-Gamma", {
      instanceArn,
      permissionSetArn: viewOnlyPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: gammaGallaudet.ref,
    });

    new CfnAssignment(this, "ViewOnly-Gallaudet-Prod", {
      instanceArn,
      permissionSetArn: viewOnlyPs.attrPermissionSetArn,
      principalType: "GROUP",
      principalId: engineersGroup.attrGroupId,
      targetType: "AWS_ACCOUNT",
      targetId: prodGallaudet.ref,
    });
  }
}
