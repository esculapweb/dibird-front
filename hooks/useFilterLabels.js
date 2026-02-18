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
    type: "species",
  });

  const getFilterLabel = (key, value) => {
    if (value === null && value === undefined) return "";

    const placeholder = "...";

    switch (key) {
      case "territory":
        return [t("territory"), countriesQuery.data?.get(Number(value)) ?? placeholder];

      case "place":
        return [t("place"), placesQuery.data?.get(Number(value)) ?? placeholder];

      case "species":
        return [t("species_single"), speciesQuery.data?.get(Number(value)) ?? placeholder];

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

    if (value.from) return [t("date"), `${t("from")} ${formatDate(value.from)}`];
    if (value.to) return [t("date"), `${t("to")} ${formatDate(value.to)}`];
  }

  if (value.type === "year" && value.year) return [t("year"), value.year.toString()];

  return "";
};
