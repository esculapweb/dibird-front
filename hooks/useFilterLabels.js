import { useTranslation } from "react-i18next";
import { useLanguage } from "../store/language-context";
import { useDropdownQuery } from "./useDropdownQuery";

import { formatDate } from "../util/helpers";
import { fetchMyCountries, fetchMyPlaces, fetchSpecies } from "../util/fetches";
import { useLocationCoords } from "../store/location-context";

export const useFilterLabels = (effectiveTerritory, hints = {}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { locationCoords } = useLocationCoords();

  const { query: countriesQuery } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
    mapResult: true,
    enabled: true,
  });

  const { query: placesQuery } = useDropdownQuery({
    type: "PlacesDropdown",
    queryFn: (sort) => fetchMyPlaces(effectiveTerritory, locationCoords, sort),
    params: [effectiveTerritory, locationCoords],
    mapResult: true,
    enabled: !!effectiveTerritory,
  });

  const { query: speciesQuery } = useDropdownQuery({
    type: "SpeciesDropdown",
    queryFn: (sort) => fetchSpecies(effectiveTerritory, sort),
    params: [effectiveTerritory, language],
    mapResult: true,
    enabled: effectiveTerritory,
  });

  const getFilterLabel = (key, value) => {
    if (value === null || value === undefined) return "";

    const placeholder = "...";

    switch (key) {
      case "territory":
        return [
          t("territory"),
          countriesQuery.data?.get(Number(value)) ?? placeholder,
        ];

      case "place":
        return [
          t("place"),
          placesQuery.data?.get(Number(value)) ?? placeholder,
        ];

      case "species":
        return [
          t("species_single"),
          hints.speciesName ??
            speciesQuery.data?.get(Number(value)) ??
            placeholder,
        ];

      case "favourite":
        return [t("favourite"), value ? t("yes") : t("no")];

      case "date":
        return formatDateFilter(value, t);

      default:
        if (Array.isArray(value)) return value.join(", ");
        return value.toString();
    }
  };

  return { getFilterLabel };
};

const formatDateFilter = (value, t) => {
  if (value.type === "range") {
    if (value.from && value.to)
      return [t("date"), `${formatDate(value.from)} – ${formatDate(value.to)}`];

    if (value.from)
      return [t("date"), `${t("from")} ${formatDate(value.from)}`];
    if (value.to) return [t("date"), `${t("to")} ${formatDate(value.to)}`];
  }

  if (value.type === "year" && value.year)
    return [t("year"), value.year.toString()];

  return "";
};
