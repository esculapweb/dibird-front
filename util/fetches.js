import api from "../services/api";

const isoToFlagEmoji = (isoCode) => {
  if (!isoCode) return "";
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));
};

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

const fetchSpeciesForTerritory = () => {
  return api.get("/api/territory-species/?territory_id=68");
};

export const fetchSeen = async () => {
  const territorySpecies = await fetchSpeciesForTerritory();
  const ids = await api.get("/myapi/seen/?territory_id=68");

  const idsSet = new Set(ids.data.map(String));

  const seenList = [];
  const notSeenList = [];

  Object.entries(territorySpecies.data).forEach(([id, value]) => {
    const item = {
      id,
      ...value,
    };

    idsSet.has(id) ? seenList.push(item) : notSeenList.push(item);
  });

  return { seenList, notSeenList };
};
