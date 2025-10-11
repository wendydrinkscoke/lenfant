interface RuntimeConfig {
  cognitoDomainPrefix: string;
  identityPoolId: string;
  region: string;
  userPoolId: string;
  userPoolWebClientId: string;
  apiBasePath: string;
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (window.location.hostname === "localhost") {
    return {
      cognitoDomainPrefix: "beta-gallaudet",
      identityPoolId: "us-east-1:8219c563-9b24-4a29-a6e9-86ab1392971b",
      region: "us-east-1",
      userPoolId: "us-east-1_VxiLkkU3P",
      userPoolWebClientId: "7ndomh55j4ja578971q5fhipgk",
      apiBasePath: "https://6vad3pwwa6.execute-api.us-east-1.amazonaws.com/prod/"
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
  } else if (hostname == "gamma.school.civictech.llc") {
    return "185272164780-trp6n8i60e8d40k07jbn71tsatnekiho.apps.googleusercontent.com";
  } else if (hostname == "school.civictech.llc") {
    return "173776540455-uc4nov74t7vb2nsb46jjodfn7g3s7b51.apps.googleusercontent.com";
  } else {
    throw new Error("No Google OAuth Client ID hard-coded.");
  }
}