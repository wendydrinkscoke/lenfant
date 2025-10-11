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
import { GallaudetInfraStage } from "../constructs/gallaudet-infra-stage";
import { GallaudetSubdomainDelegatorStage } from "../constructs/gallaudet-subdomain-delegator-stage";

export interface StageConfig {
  name: string;
  account: string;
  region: string;
}

export interface GallaudetPipelineStackProps extends StackProps {
  stages: StageConfig[];
}

export class GallaudetPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: GallaudetPipelineStackProps,
  ) {
    super(scope, id, props);
    const gallaudetPipeline = new CodePipeline(this, "GallaudetPipeline", {
      pipelineName: "GallaudetPipeline",
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
        cache: Cache.bucket(
          new Bucket(this, "gallaudet-code-build-cache-bucket"),
        ),
        partialBuildSpec: BuildSpec.fromObject({
          version: "0.2",
          cache: {
            paths: [
              "/root/.m2/**/*",
              "/root/.gradle/**/*",
              "/root/.pnpm-store/**/*",
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

    const subdomainDelegationStage = new GallaudetSubdomainDelegatorStage(
      this,
      "DelegateDomain",
      {
        account: this.account,
        region: this.region,
      },
    );

    gallaudetPipeline.addStage(subdomainDelegationStage);

    for (const stage of props.stages) {
      gallaudetPipeline.addStage(
        new GallaudetInfraStage(this, stage.name, {
          name: stage.name.toLowerCase(),
          account: stage.account,
          region: stage.region,
        }),
      );
    }

    gallaudetPipeline.buildPipeline();

    for (const stage of props.stages) {
      gallaudetPipeline.synthProject.addToRolePolicy(
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
