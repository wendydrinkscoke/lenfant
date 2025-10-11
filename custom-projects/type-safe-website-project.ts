import { ReactTypeScriptProjectOptions } from "@aws/pdk/cloudscape-react-ts-website";
import { TypeSafeApiProject } from "@aws/pdk/type-safe-api";
import { ReactTypeScriptProject } from "projen/lib/web/react";

export interface TypeSafeWebsiteProjectOptions extends ReactTypeScriptProjectOptions {
  readonly typeSafeApis: TypeSafeApiProject[];
}

export class TypeSafeWebsiteProject extends ReactTypeScriptProject {
  constructor(options: TypeSafeWebsiteProjectOptions) {
    super(
        {
            ...options, 
            defaultReleaseBranch: "main"
        }
    );

    options.typeSafeApis.forEach((typeSafeApi) => {
      const hooks = typeSafeApi.library?.typescriptReactQueryHooks;
      const libraryHooksPackage = hooks?.package?.packageName;
      const libraryHooksPackageVersion = hooks?.package?.manifest.version;
      if (!libraryHooksPackage) {
        throw new Error(
          "Cannot pass in a Type Safe Api without React Hooks Library configured!",
        );
      }
      this.addDeps(`${libraryHooksPackage}@${libraryHooksPackageVersion}`);
    });
  }
}
