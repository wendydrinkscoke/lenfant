import { Configuration, DefaultApi } from "gallaudet-api-typescript-react-query-hooks";
import { getRuntimeConfig } from "./environment-utils";

export async function getGallaudetApi() {
  const runtimeConfig = await getRuntimeConfig();
  const basePath = runtimeConfig.apiBasePath as string;
  let idToken: string | null = null;
  try {
    idToken =
      localStorage.getItem("id_token") ||
      localStorage.getItem("cognito_id_token");
  } catch {
    console.warn("No ID token found in local storage.")
  }
  const apiConfig = new Configuration({
    basePath: basePath,
    headers: {
      Authorization: idToken as string,
    },
    fetchApi: window.fetch.bind(window),
  });
  return new DefaultApi(apiConfig);
};
