import axios, { AxiosError } from "axios";
import i18n from "./i18n";

import { createTranslatedError } from "./api";
import { Config } from "../constants/config";
import { GeoDetails } from "../types";

const nominatimApi = axios.create({
  baseURL: Config.geoCodingBaseUrl,
  timeout: 5000,
});

nominatimApi.interceptors.request.use(
  (config) => {
    config.headers["Accept-Language"] = i18n.language || "en";
    config.headers["User-Agent"] = "DiBird/1.0 (dibird.com@gmail.com)";
    return config;
  },
  (error) => Promise.reject(error),
);

export const reverseGeocode = async (latitude: number, longitude: number) => {
  try {
    const params = {
      format: "json",
      lat: latitude,
      lon: longitude,
      zoom: 10,
      addressdetails: 1,
    };
    const response = await nominatimApi.get("/reverse", { params });
    const data = response.data;
    return {
      country: data.address?.country,
      countryCode: data.address?.country_code,
      city: data.address?.city || data.address?.town || data.address?.village,
      address: data.display_name,
      raw: data.address,
    };
  } catch (error) {
    throw createTranslatedError(error as AxiosError);
  }
};

const geocodeCache = new Map<string, GeoDetails>();

export const cachedReverseGeocode = async (latitude: number, longitude: number) => {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const result = await reverseGeocode(latitude, longitude);
  if (result) {
    geocodeCache.set(cacheKey, result);
  }

  return result;
};
