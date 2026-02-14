interface RuntimeConfig {
  cognitoDomainPrefix: string;
  identityPoolId: string;
  region: string;
  userPoolId: string;
  userPoolWebClientId: string;
  apiBasePath: string;
}

export type RuntimeStage = "local" | "beta" | "gamma" | "prod" | "unknown";

export function inferRuntimeStageFromHostname(
  hostname: string = window.location.hostname,
): RuntimeStage {
  if (hostname === "localhost") {
    return "local";
  }
  if (hostname === "beta.school.civictech.llc") {
    return "beta";
  }
  if (hostname === "gamma.school.civictech.llc") {
    return "gamma";
  }
  if (hostname === "school.civictech.llc") {
    return "prod";
  }
  return "unknown";
}

export function shouldShowDeveloperPortalComingSoonFeatures(
  stage: RuntimeStage = inferRuntimeStageFromHostname(),
): boolean {
  return stage !== "prod";
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (window.location.hostname === "localhost") {
    return {
      cognitoDomainPrefix: "beta-gallaudet",
      identityPoolId: "us-east-1:0d4a3159-37d9-46ae-8bd9-51a241024bca",
      region: "us-east-1",
      userPoolId: "us-east-1_K3ecEDWBj",
      userPoolWebClientId: "6cjqp8m6e6pfjtkmlk54cff7t0",
      apiBasePath: "https://api.beta.school.civictech.llc/",
    };
  }

  try {
    const response = await fetch('/runtime-config.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch runtime config:", error);
    throw error;
  }
}

export function getGoogleAuthClientID() {
  // TODO: Maybe this should be a server call to fetch the client ID from Secrets Manager
  // since it's just a little ugly to hard-code constants on the frontend that already
  // exist on the backend. Might be overengineering, but it could be cleaner.
  let hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "beta.school.civictech.llc") {
    return "654823757539-0q0430rn8h8bj701aejftdhe62m0qdn7.apps.googleusercontent.com";
  } else if (hostname === "gamma.school.civictech.llc") {
    return "949890986084-mdg872q4664ajcfb01sb0htdhrmr3jgu.apps.googleusercontent.com";
  } else if (hostname === "school.civictech.llc") {
    return "648341560846-hn9anfo8ljdus0emd60hi6vb0t8ver1j.apps.googleusercontent.com";
  } else {
    throw new Error("No Google OAuth Client ID hard-coded.");
  }
}
