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
      apiBasePath: "https://6vad3pwwa6.execute-api.us-east-1.amazonaws.com/prod/",
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

export function getRobloxOAuthClientId() {
  // TODO: Fill in the correct Roblox OAuth client IDs per environment.
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "beta.school.civictech.llc") {
    return "5651729328866129117";
  } else if (hostname === "gamma.school.civictech.llc") {
    return "6931351931854279191";
  } else if (hostname === "school.civictech.llc") {
    return "2423359673341824485";
  } else {
    throw new Error("No Roblox OAuth Client ID hard-coded.");
  }
}
