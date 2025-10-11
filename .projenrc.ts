import { InfrastructureTsProject } from "@aws/pdk/infrastructure";
import { MonorepoTsProject } from "@aws/pdk/monorepo";
import {
  DocumentationFormat,
  Language,
  Library,
  ModelLanguage,
  TypeSafeApiProject,
} from "@aws/pdk/type-safe-api";
import { NodePackageManager } from "projen/lib/javascript";
import { TypeSafeWebsiteProject } from "./custom-projects/type-safe-website-project";

const monorepo = new MonorepoTsProject({
  name: "lenfant",
  devDeps: ["@aws/pdk"],
  gitIgnoreOptions: {
    ignorePatterns: [".idea", ".DS_Store"],
  },
  packageManager: NodePackageManager.PNPM,
  licensed: false,
  licenseOptions: {
    disableDefaultLicenses: true,
  }
});

monorepo.vscode?.settings.addSettings({
  "explorer.excludeGitIgnore": true,
  "files.exclude": {
    "**/.eslintrc.json": true,
    "**/.gitattributes": true,
    "**/.npmignore": true,
    "**/.npmrc": true,
    "**/.nx": true,
    "**/.nxignore": true,
    "**/.prettierignore": true,
    "**/.prettierrc.json": true,
    "**/.projen": true,
    "**/.syncpackrc.json": true,
    "**/.vscode": true,
    "**/cdk.json": true,
    "**/generated": true,
    "**/LICENSE": true,
    "**/nx.json": true,
    "**/package.json": true,
    "**/pnpm-lock.yaml": true,
    "**/pnpm-workspace.yaml": true,
    "**/project.json": true,
    "**/smithy-build.json": true,
    "**/tsconfig.dev.json": true,
    "**/tsconfig.json": true
  },
});

const bartholdiApi = new TypeSafeApiProject({
  name: "bartholdi-api",
  parent: monorepo,
  outdir: "packages/bartholdi-api",
  model: {
    language: ModelLanguage.SMITHY,
    options: {
      smithy: {
        serviceName: {
          namespace: "org.bartholdi",
          serviceName: "Bartholdi",
        },
      },
    },
  },
  infrastructure: {
    language: Language.TYPESCRIPT,
  },
  handlers: {
    languages: [Language.TYPESCRIPT],
  },
  documentation: {
    formats: [DocumentationFormat.HTML_REDOC],
  },
});
bartholdiApi.handlers.typescript?.addDeps(
  "aws-sdk", 
  "jsonwebtoken"
);
bartholdiApi.handlers.typescript?.addDevDeps(
  "@types/jsonwebtoken",
)

const gallaudetApi = new TypeSafeApiProject({
  name: "gallaudet-api",
  parent: monorepo,
  outdir: "packages/gallaudet-api",
  model: {
    language: ModelLanguage.SMITHY,
    options: {
      smithy: {
        serviceName: {
          namespace: "llc.civictech.school",
          serviceName: "Gallaudet",
        },
      },
    },
  },
  infrastructure: {
    language: Language.TYPESCRIPT,
  },
  handlers: {
    languages: [Language.TYPESCRIPT],
  },
  documentation: {
    formats: [DocumentationFormat.HTML_REDOC],
  },
  library: {
    libraries: [Library.TYPESCRIPT_REACT_QUERY_HOOKS],
  },
});

gallaudetApi.handlers.typescript?.addDeps(
  "@googleapis/classroom",
  "@aws-sdk/client-sesv2",
  "@types/aws-lambda",
  "aws-sdk", 
  "gaxios",
  "google-auth-library",
);

new TypeSafeWebsiteProject({
  name: "gallaudet-site",
  typeSafeApis: [gallaudetApi],
  packageManager: NodePackageManager.PNPM,
  outdir: "packages/gallaudet-site",
  parent: monorepo,
  eslint: false,
  deps: [
    "@radix-ui/react-accordion",
    "@radix-ui/react-avatar",
    "@radix-ui/react-dialog",
    "@radix-ui/react-label",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-separator",
    "@radix-ui/react-slot",
    "@radix-ui/react-tooltip",
    "@radix-ui/react-select",
    "@shadcn/ui",
    "class-variance-authority",
    "clsx",
    "lucide-react",
    "next-themes",
    "postcss",
    "react-router-dom",
    "sonner",
    "tailwind-merge",
    "tailwindcss",
    "tailwindcss-animate",
  ],
  tsconfig: {
    compilerOptions: {
      target: "ES2021",
    },
  },
  licensed: false
})

new InfrastructureTsProject({
  name: "infra",
  parent: monorepo,
  outdir: "packages/infra",
  typeSafeApis: [bartholdiApi, gallaudetApi],
  deps: [
    "@types/aws-lambda",
    "aws-sdk",
  ],
  sampleCode: false,
  licensed: false
});

monorepo.synth();
