const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
const mediaBaseUrl = process.env.EXPO_PUBLIC_MEDIA_URL;
const env = process.env.EXPO_PUBLIC_ENV;

if (!baseUrl) {
  throw new Error("EXPO_PUBLIC_BASE_URL is missing");
}

if (!mediaBaseUrl) {
  throw new Error("EXPO_PUBLIC_MEDIA_URL is missing");
}

if (!__DEV__) {
  if (env === "production" && baseUrl.includes("192.168")) {
    throw new Error("Production is using local API!");
  }
}

export const Config = {
  env,
  baseUrl,
  mediaUrl: `${mediaBaseUrl}/media`,
  defaultCoords: [-0.1423, 51.5048] as [number, number],
  mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  geoCodingBaseUrl: "https://nominatim.openstreetmap.org",
  isDev: __DEV__,
  isProd: env === "production",
  googleWebClientId:
    "450151091368-2c3vvb49mkuhloifvgfkmbgqgdkhqki7.apps.googleusercontent.com",
  googleIosClientId:
    "450151091368-ha8kdd4hq7vil079e10p59pcr7ln0pgj.apps.googleusercontent.com",  
};
