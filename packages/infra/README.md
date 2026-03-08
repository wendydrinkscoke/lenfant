## Getting started

Refer to [Developer Guide](https://aws.github.io/aws-pdk/developer_guides/infrastructure/index.html)

## Deployment Instructions
1. Enable IAM Identity Center.
1. Run `npx projen build && npx projen deploy ManagementStack`
1. Wait for accounts to be provisioned and note their account IDs.
1. Put their account IDs in the stages.ts file.
1. Bootstrap each account by running the `bootstrap-child.sh` script (e.g.
  you can run `./bootstrap-child.sh 679451892070 582182559291 174512274702`)
1. Create a Roblox client secret, with a client ID and client secret as JSON
    attributes in each child account.
1. Run `npx projen deploy PipelineStack`
1. Let the pipeline deploy.

## Manual actions required to deploy a new Galluadet stage
These steps need to be performed prior to deploying to a new stage. See the
screenshots prefixed with `google-oauth-project-client-and-secret-configuration`
for detialed screenshots of this process.

1. Navigate to the Google Cloud Console.
1. Log in to the cupwendyscup@gmail.com account.
1. Create a project e.g. `gallaudet-gamma`.
1. Configure the "App Information", "Audience", and "Contact Info" sections.
  - For app name put something like `CivicTech for Schools (GAMMA)`. It doesn't
    really matter what you put in terms of functionality/code, but it'll show 
    up to end users.
  - For audience, select "External"
  - For "Contact Info" put cupwendyscup@gmail.com
1. Create a new oauth "client" named "gallaudet-gamma".
1. Download the clientId and clientSecret as a JSON.
1. You can configure additional branding information if desired.
1. You must eventually add redirect URIs (e.g. 
https://gamma-gallaudet.auth.us-east-1.amazoncognito.com/oauth2/idpresponse and
https://beta.school.civictech.llc/google/callback) for app functioning.
1. Assume the `Bootstrapper` role from the 
[AWS Access Portal](https://d-90663e9023.awsapps.com/start/#/?tab=accounts).
1. Make sure you are in the correct region (us-east-1).
1. Create a secret called `google-oauth-credentials`. Select "Other type of 
secret", and use the key-value pairs `clientId` and `clientSecret` and paste in
the values from the previously downloaded JSON.
1. For the description, be sure to mention that this resource was created manually.
1. Create the secret.

1. Enable promotion to the stage via the `GallaudetPipeline` in the management
account. This will require admin access there so reach out to Wendy for this.
1. Additional setup is required to get SimpleEmailService working by requesting
a quota increase.

### Other Steps
1. Edit the `getGoogleAuthClientID` function in the codebase with the clientId,
commit that, and push it.
1. For each project, enable [Google Classroom API integration](https://console.cloud.google.com/marketplace/product/google/classroom.googleapis.com).

![](packages/infra/documentation-assets/google-oauth-project-client-and-secret-configuration-15.png)

1. Request production access for AWS SES. See the documentation assets prefixed
with `ses-setup` in order to see what this process entails. It's essentially
just opening a support ticket and explaining reasoning. Without doing this,
all lambdas will fail. You'll need to keep responding to AWS Support's 
correspondences obviously.