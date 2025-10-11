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
import { BartholdiInfraStage } from "../constructs/bartholdi-infra-stage";
import { BartholdiSubdomainDelegatorStage } from "../constructs/bartholdi-subdomain-delegator-stage";

export interface StageConfig {
  name: string;
  account: string;
  region: string;
}

export interface BartholdiPipelineStackProps extends StackProps {
  stages: StageConfig[];
}

export class BartholdiPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: BartholdiPipelineStackProps,
  ) {
    super(scope, id, props);
    const bartholdiPipeline = new CodePipeline(this, "BartholdiPipeline", {
      pipelineName: "BartholdiPipeline",
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
        cache: Cache.bucket(
          new Bucket(this, "bartholdi-code-build-cache-bucket"),
        ),
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

    const subdomainDelegationStage = new BartholdiSubdomainDelegatorStage(
      this,
      "DelegateDomain",
      {
        account: this.account,
        region: this.region,
      },
    );

    bartholdiPipeline.addStage(subdomainDelegationStage);

    for (const stage of props.stages) {
      bartholdiPipeline.addStage(
        new BartholdiInfraStage(this, stage.name, {
          name: stage.name.toLowerCase(),
          account: stage.account,
          region: stage.region,
        }),
      );
    }

    bartholdiPipeline.buildPipeline();

    for (const stage of props.stages) {
      bartholdiPipeline.synthProject.addToRolePolicy(
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
