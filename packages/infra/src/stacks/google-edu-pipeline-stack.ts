import { Stack, StackProps } from "aws-cdk-lib";
import { BuildSpec, Cache, ComputeType } from "aws-cdk-lib/aws-codebuild";
import { PipelineType } from "aws-cdk-lib/aws-codepipeline";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";
import { PIPELINE_ACCOUNT_CODE_CONNECTION_ARN, REPO } from "../constants";
import { GoogleEduSubdomainOwnershipStage } from "../constructs/google-edu-subdomain-ownership-stage";

export interface StageConfig {
  name: string;
  account: string;
  region: string;
}

export interface GoogleEduPipelineStackProps extends StackProps {
  stages: StageConfig[];
}

export class GoogleEduPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: GoogleEduPipelineStackProps,
  ) {
    super(scope, id, props);
    const googleEduPipeline = new CodePipeline(this, "GoogleEduPipeline", {
      pipelineName: "GoogleEduPipeline",
      pipelineType: PipelineType.V2,
      crossAccountKeys: true,
      synth: new ShellStep("Synth", {
        input: CodePipelineSource.connection(REPO, "main", {
          connectionArn: PIPELINE_ACCOUNT_CODE_CONNECTION_ARN,
        }),
        env: {
          NODE_OPTIONS: "--max-old-space-size=4096",
        },
        installCommands: ["npm install -g aws-cdk pnpm", "npx projen install"],
        commands: ["npx projen build"],
        primaryOutputDirectory: "packages/infra/cdk.out",
      }),
      codeBuildDefaults: {
        // https://github.com/leegilmorecode/Serverless-AWS-CDK-Best-Practices-Patterns-Part3/blob/c7caf9b5c00ee510210390310d4848ef3b82edb9/serverless-pro/lib/pipeline/pipeline-stack/pipeline-stack.ts#L30C55-L30C78
        cache: Cache.bucket(new Bucket(this, "gedu-code-build-cache-bucket")),
        partialBuildSpec: BuildSpec.fromObject({
          version: "0.2",
          cache: {
            paths: [
              "/root/.m2/**/*",
              "/root/.gradle/**/*",
              "/root/.pnpm-store/**/*",
              // https://github.com/vinarius/deployment-process/blob/7bcf369278ffb97b8a88a14ab8d0082219b0ccc1/src/stacks/cicd.ts#L50C16-L50C33
              "node_modules/**/*",
            ],
          },
        }),
      },
      synthCodeBuildDefaults: {
        buildEnvironment: {
          computeType: ComputeType.LARGE,
        },
      },
    });

    // Proves ownership of `gedu.demo.civictech.llc` domain to Google.
    const subdomainOwnershipStage = new GoogleEduSubdomainOwnershipStage(
      this,
      "ProveOwnership",
    );

    googleEduPipeline.addStage(subdomainOwnershipStage);

    googleEduPipeline.buildPipeline();

    for (const stage of props.stages) {
      googleEduPipeline.synthProject.addToRolePolicy(
        new PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [
            `arn:aws:iam::${stage.account}:role/cdk-*-lookup-role-${stage.account}-us-east-1`,
          ],
        }),
      );
    }
  }
}
