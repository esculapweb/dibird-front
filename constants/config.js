const baseUrl = "http://192.168.0.103:8000";
// const mediaBaseUrl = "https://s.dibird.com";
const mediaBaseUrl = baseUrl;

export const Config = {
  baseUrl,
  mediaBaseUrl,
  mediaUrl: mediaBaseUrl + "/media",
  defaultCoords: [-0.1423, 51.5048],
  mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};
