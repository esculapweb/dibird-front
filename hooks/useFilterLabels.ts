import { useTranslation } from "react-i18next";
import { useLanguage } from "../store/language-context";
import { useDropdownQuery } from "./useDropdownQuery";

import { formatDate, roundCoords } from "../util/helpers";
import { fetchMyCountries, fetchMyPlaces, fetchSpecies } from "../util/fetches";
import { useLocation } from "../store/location-context";

import { DateFilter, AllFiltersKey } from "../types";

interface FilterHints {
  speciesName?: string;
  [key: string]: unknown;
}

export const useFilterLabels = (
  effectiveTerritory: number | null,
  hints: FilterHints = {},
) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { locationCoords } = useLocation();

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
    params: [effectiveTerritory, roundCoords(locationCoords)],
    mapResult: true,
    enabled: !!effectiveTerritory,
  });

  const { query: speciesQuery } = useDropdownQuery({
    type: "SpeciesDropdown",
    queryFn: (sort) => fetchSpecies(effectiveTerritory, sort, undefined),
    params: [effectiveTerritory, language, null],
    mapResult: true,
    enabled: !!effectiveTerritory,
  });

  const getFilterLabel = (
    key: AllFiltersKey,
    value: unknown,
  ): string | [string, string] => {
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

      case "unsynced":
        return [t("sync_status"), t("unsynced_only")];

      case "private":
        return [t("privacy"), value ? t("private") : t("public")];

      case "has_photo":
        return [t("section_photos"), value ? t("yes") : t("no")];

      case "source":
        return [
          t("source"),
          value === "ebird" ? t("source_ebird") : t("source_dibird"),
        ];

      case "radius":
        return [t("radius"), `${value} ${t("km")}`];

      case "date":
        return formatDateFilter(value as DateFilter, t);

      default:
        if (Array.isArray(value)) return value.join(", ");
        return value.toString();
    }
  };

  return { getFilterLabel };
};

const formatDateFilter = (
  value: DateFilter,
  t: (key: string) => string,
): [string, string] | "" => {
  if (!value) return "";
  if (value.type === "range") {
    if (value.from && value.to)
      return [
        t("period"),
        `${formatDate(value.from)} – ${formatDate(value.to)}`,
      ];

    if (value.from)
      return [t("period"), `${t("from")} ${formatDate(value.from)}`];
    if (value.to) return [t("period"), `${t("to")} ${formatDate(value.to)}`];
  }

  if (value.type === "year" && value.year)
    return [t("year"), value.year.toString()];

  if (value.type === "today") return [t("period"), t("today")];

  if (value.type === "this_year") return [t("period"), t("this_year")];

  return "";
};
