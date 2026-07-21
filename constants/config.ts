const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
const mediaBaseUrl = process.env.EXPO_PUBLIC_MEDIA_URL;
const env = process.env.EXPO_PUBLIC_ENV;
const appSecretKey = process.env.EXPO_PUBLIC_APP_SECRET_KEY;

if (!baseUrl) {
  throw new Error("EXPO_PUBLIC_BASE_URL is missing");
}

if (!mediaBaseUrl) {
  throw new Error("EXPO_PUBLIC_MEDIA_URL is missing");
}

if (!appSecretKey) {
  throw new Error("EXPO_PUBLIC_APP_SECRET_KEY is missing");
}

if (!__DEV__) {
  if (env === "production" && baseUrl.includes("192.168")) {
    throw new Error("Production is using local API!");
  }
}

export const Config = {
  env,
  baseUrl,
  appSecretKey,
  mediaUrl: `${mediaBaseUrl}/media`,
  mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  email: "admin@dibird.com",
  googleWebClientId:
    "135122891711-1n5e7daoce1f5immq6n1pta52627d6ti.apps.googleusercontent.com",
  googleIosClientId:
    "135122891711-h2vjlr2ute6gtdfjk6ag8pb2bp2o1a71.apps.googleusercontent.com",
  publicEndpoints: [
    "/api-auth/login",
    "/api-auth/registration",
    "/api/timezones2/",
    "/api/page2/",
  ],
};
