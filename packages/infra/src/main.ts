import { CdkGraph, FilterPreset, Filters } from "@aws/pdk/cdk-graph";
import { CdkGraphDiagramPlugin } from "@aws/pdk/cdk-graph-plugin-diagram";
import { CdkGraphThreatComposerPlugin } from "@aws/pdk/cdk-graph-plugin-threat-composer";
import { PDKNag } from "@aws/pdk/pdk-nag";
import { MANAGEMENT_ACCOUNT_ID, MANAGEMENT_REGION } from "./constants";
import { BartholdiPipelineStack } from "./stacks/bartholdi-pipeline-stack";
import { GallaudetPipelineStack } from "./stacks/gallaudet-pipeline-stack";
import { GoogleEduPipelineStack } from "./stacks/google-edu-pipeline-stack";
import { ManagementStack } from "./stacks/management-stack";
import {
  BARTHOLDI_STAGES,
  GALLAUDET_STAGES,
  SINGULAR_GOOGLE_EDU_DEMO_SITE_STAGE,
} from "./stages";

/* eslint-disable @typescript-eslint/no-floating-promises */
(async () => {
  const app = PDKNag.app({
    nagPacks: [],
  });

  new ManagementStack(app, "ManagementStack", {
    env: {
      account: MANAGEMENT_ACCOUNT_ID,
      region: MANAGEMENT_REGION,
    },
  });

  new BartholdiPipelineStack(app, "BartholdiPipelineStack", {
    env: {
      account: MANAGEMENT_ACCOUNT_ID,
      region: MANAGEMENT_REGION,
    },
    stages: BARTHOLDI_STAGES,
  });

  new GoogleEduPipelineStack(app, "GoogleEduPipelineStack", {
    env: {
      account: MANAGEMENT_ACCOUNT_ID,
      region: MANAGEMENT_REGION,
    },
    stages: SINGULAR_GOOGLE_EDU_DEMO_SITE_STAGE,
  });

  new GallaudetPipelineStack(app, "GallaudetPipelineStack", {
    env: {
      account: MANAGEMENT_ACCOUNT_ID,
      region: MANAGEMENT_REGION,
    },
    stages: GALLAUDET_STAGES,
  });

  const graph = new CdkGraph(app, {
    plugins: [
      new CdkGraphDiagramPlugin({
        defaults: {
          filterPlan: {
            preset: FilterPreset.COMPACT,
            filters: [{ store: Filters.pruneCustomResources() }],
          },
        },
      }),
      new CdkGraphThreatComposerPlugin(),
    ],
  });

  app.synth();
  await graph.report();
})();
