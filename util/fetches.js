import i18n from "../services/i18n";
import api from "../services/api";

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

const fetchSpeciesForTerritory = (territory_id) => {
  return api.get(`/api/territory-species/?territory_id=${territory_id}`);
};

export const fetchSeen = async () => {
  const territorySpecies = await fetchSpeciesForTerritory(68);
  const stat = await api.get('/myapi/stat/?per_page=20000&territory=68')

  const idsSet = new Set(
    stat?.data?.results.map(item => item.species)
  );

  const seenList = stat?.data?.results.map(item => ({
    id: item.species,
    ...item,
  }));

  const notSeenList = Object.entries(territorySpecies.data)
  .filter(([speciesId]) => !idsSet.has(Number(speciesId)))
  .map(([speciesId, sp]) => ({
    id: Number(speciesId),
    ...sp
  }));

  return { seenList, notSeenList };
};
