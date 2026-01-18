import i18n from "../services/i18n";
import api from "../services/api";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../constants/styles";

export const loadDecorator = async (loaderFn) => {
  try {
    await loaderFn();
  } catch (e) {
    console.warn(
      `[${new Date().toLocaleString()}] Failed to load data`,
      e.code,
      e.message,
    );
  }
};

export const isoToFlagEmoji = (isoCode) => {
  if (!isoCode) return "";
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));
};

export const formatDate = (isoDate) =>
  new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(isoDate));

const cleanFilters = (filters) =>
  Object.fromEntries(Object.entries(filters).filter(([_, v]) => v != null));

export const fetchTimezones = async () => {
  const res = await api.get("/api/timezones/");
  return res.data.map(([value, label]) => ({
    value,
    label,
  }));
};

export const fetchCountries = async () => {
  const res = await api.get("/api/territory-dropdown-my/");
  return res.data.map(([value, label]) => ({
    value,
    label: label.label,
    icon: isoToFlagEmoji(label["data-code"]),
  }));
};

export const fetchMyCountries = async (favOnly = false) => {
  let url = "/myapi/territory/";
  if (favOnly) url = `${url}?fav_only=${favOnly}`;
  const res = await api.get(url);
  return Object.entries(res.data)
    .map(([value, item]) => ({
      value,
      label: item.name,
      icon: isoToFlagEmoji(item.code),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
};

export const fetchMyPlaces = async (territory = null) => {
  const params = {
    o: "-favourite,name",
  };
  if (territory) params.territory = territory;
  const res = await api.get("/myapi/place-dropdown/", { params });

  return res.data.map(([value, item]) => ({
    value,
    label: item.label,
    icon: item["data-favourite"] && (
      <Ionicons name="star" size={14} color={Colors.accent} />
    ),
  }));
};

const fetchSpeciesForTerritory = (territory_id) => {
  return api.get(`/api/territory-species/?territory_id=${territory_id}`);
};

export const fetchSeen = async (filters = {}, order = "name") => {
  console.log('filters', filters)

  let notSeenList = [];
  const stat = await api.get("/myapi/stat/", {
    params: {
      ...cleanFilters(filters),
      per_page: 20000,
      o: order,
    },
  });

  const idsSet = new Set(stat?.data?.results.map((item) => item.species));

  const seenList = stat?.data?.results.map((item) => ({
    id: item.species,
    ...item,
  }));

  const territory = filters?.territory;
  if (territory) {
    const territorySpecies = await fetchSpeciesForTerritory(territory);
    notSeenList = Object.entries(territorySpecies.data)
      .filter(([speciesId]) => !idsSet.has(Number(speciesId)))
      .map(([speciesId, sp]) => ({
        id: Number(speciesId),
        ...sp,
      }))
      .sort((a, b) => a.sp_name_lang.localeCompare(b.sp_name_lang, i18n.language));
  }

  return { seenList, notSeenList };
};
