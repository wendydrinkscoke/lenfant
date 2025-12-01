import {
  Configuration,
  DefaultApi,
} from "gallaudet-api-typescript-react-query-hooks";
import { getRuntimeConfig } from "./environment-utils";
import { MockGallaudetApi } from "./mock-gallaudet-api";

const shouldUseMockApi = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const onLocalhost = window.location.hostname === "localhost";

  if (!onLocalhost) {
    return false;
  }

  try {
    return localStorage.getItem("gallaudet-use-real-api") !== "true";
  } catch {
    return true;
  }
};

export async function getGallaudetApi(): Promise<DefaultApi> {
  const runtimeConfig = await getRuntimeConfig();
  const basePath = runtimeConfig.apiBasePath as string;

  if (shouldUseMockApi()) {
    return new MockGallaudetApi();
  }

  let idToken: string | null = null;
  try {
    idToken =
      localStorage.getItem("id_token") ||
      localStorage.getItem("cognito_id_token");
  } catch {
    console.warn("No ID token found in local storage.");
  }
  const apiConfig = new Configuration({
    basePath: basePath,
    headers: {
      Authorization: idToken as string,
    },
    fetchApi: window.fetch.bind(window),
  });
  return new DefaultApi(apiConfig);
}
