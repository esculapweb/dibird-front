import { useTranslation } from "react-i18next";
import { useLanguage } from "../store/language-context";
import { useTranslatedQuery } from "./useQueryWithTranslation";

import { formatDate } from "../util/fetches";
import { fetchMyCountries, fetchMyPlaces, fetchSpecies } from "../util/fetches";

export const useFilterLabels = (filters) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const countriesQuery = useTranslatedQuery({
    queryFn: () => fetchMyCountries(false),
    params: [language],
    mapResult: true,
    enabled: true,
    type: "mycountries",
  });

  const placesQuery = useTranslatedQuery({
    queryFn: () => fetchMyPlaces(filters?.territory ?? null),
    params: [filters?.territory ?? null, language],
    mapResult: true,
    enabled: !!filters?.territory,
    type: "places",
  });

  const speciesQuery = useTranslatedQuery({
    queryFn: () => fetchSpecies(filters?.territory ?? null),
    params: [filters?.territory ?? null, language],
    mapResult: true,
    enabled: !!filters?.territory,
    type: "speciesall",
  });

  const getFilterLabel = (key, value) => {
    if (!value) return "";

    switch (key) {
      case "territory":
        return countriesQuery.data?.get(Number(value)) ?? value.toString();

      case "place":
        return placesQuery.data?.get(Number(value)) ?? value.toString();

      case "species":
        return speciesQuery.data?.get(Number(value)) ?? value.toString();

      case "favourite":
        return value ? t("yes") : t("no");

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
      return `${formatDate(value.from)} – ${formatDate(value.to)}`;

    if (value.from) return `${t("from")} ${formatDate(value.from)}`;

    if (value.to) return `${t("to")} ${formatDate(value.to)}`;
  }

  if (value.type === "year" && value.year) return value.year.toString();

  return "";
};
