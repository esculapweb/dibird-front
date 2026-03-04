import i18n from "../services/i18n";

export const sortOptionsList = (screen) => {
  switch (screen) {
    case "Stat":
      return [
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
        { label: i18n.t("date_sort_desc"), value: "-date_time" },
        { label: i18n.t("date_sort"), value: "date_time" },
      ];

    case "Places":
      return [
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
        // { label: i18n.t("favourite_asc"), value: "favourite,name" },
        // { label: i18n.t("favourite_desc"), value: "-favourite,name" },
        // { label: i18n.t("territory_asc"), value: "territory,name" },
        // { label: i18n.t("territory_desc"), value: "-territory,name" },
        { label: i18n.t("species_count"), value: "species_count,name" },
        { label: i18n.t("species_count_desc"), value: "-species_count,name" },
        { label: i18n.t("observation_count"), value: "observation_count,name" },
        {
          label: i18n.t("observation_count_desc"),
          value: "-observation_count,name",
        },
        // { label: i18n.t("diary_count"), value: "diary_count" },
        // { label: i18n.t("diary_count_desc"), value: "-diary_count" },
      ];

    case "Observations":
      return [
        { label: i18n.t("date_sort_desc"), value: "-date_time" },
        { label: i18n.t("date_sort"), value: "date_time" },
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        // { label: t("alphabetic"), value: "species_name" },
        // { label: t("alphabetic_desc"), value: "-species_name" },
      ];

    case "Diaries":
      return [
        { label: i18n.t("date_sort_desc"), value: "-date_time" },
        { label: i18n.t("date_sort"), value: "date_time" },
        // { label: i18n.t("alphabetic"), value: "species_name" },
        // { label: i18n.t("alphabetic_desc"), value: "-species_name" },
        { label: i18n.t("observation_count"), value: "observation_count,name" },
        {
          label: i18n.t("observation_count_desc"),
          value: "-observation_count,name",
        },
      ];

    case "CountriesDropdown":
      return [
        { label: i18n.t("favourite_desc"), value: "-favourite,name" },
        { label: i18n.t("favourite_asc"), value: "favourite,name" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
      ];

    case "PlacesDropdown":
      return [
        { label: i18n.t("favourite"), value: "-favourite,name" },
        { label: i18n.t("favourite_desc"), value: "favourite,name" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
        { label: i18n.t("distance"), value: "distance" },
        { label: i18n.t("distande_desc"), value: "-distance" },
      ];

    case "SpeciesDropdown":
      return [
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
      ];

    default:
      return [];
  }
};
