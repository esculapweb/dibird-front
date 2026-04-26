import i18n from "../services/i18n";

export const sortOptionsList = (screen: string | undefined) => {
  switch (screen) {
    case "Stat":
    case "UserStat":
      return [
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("date_sort_desc"), value: "-seen,-date_time" },
        { label: i18n.t("date_sort"), value: "-seen,date_time" },
      ];

    case "Observations":
      return [
        { label: i18n.t("alphabetic"), value: "species_name" },
        { label: i18n.t("alphabetic_desc"), value: "-species_name" },
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("date_sort_desc"), value: "-date_time" },
        { label: i18n.t("date_sort"), value: "date_time" },
      ];
    case "DiaryDetail":
      return [
        { label: i18n.t("alphabetic"), value: "species_name" },
        { label: i18n.t("alphabetic_desc"), value: "-species_name" },
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("date_sort_desc"), value: "-created_at" },
        { label: i18n.t("date_sort"), value: "created_at" },
      ];

    case "Diaries":
      return [
        { label: i18n.t("date_sort_desc"), value: "-date_time" },
        { label: i18n.t("date_sort"), value: "date_time" },
        { label: i18n.t("observation_count"), value: "observation_count,name" },
        {
          label: i18n.t("observation_count_desc"),
          value: "-observation_count,name",
        },
      ];

    case "Places":
      return [
        { label: i18n.t("distance_asc"), value: "distance" },
        { label: i18n.t("distance_desc"), value: "-distance" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
        { label: i18n.t("favourite_asc"), value: "-favourite,name" },
        { label: i18n.t("favourite_desc"), value: "favourite,name" },
        { label: i18n.t("species_count"), value: "species_count,name" },
        { label: i18n.t("species_count_desc"), value: "-species_count,name" },
        { label: i18n.t("observation_count"), value: "observation_count,name" },
        {
          label: i18n.t("observation_count_desc"),
          value: "-observation_count,name",
        },
      ];

    case "PlacesDropdown":
      return [
        { label: i18n.t("distance_asc"), value: "distance" },
        { label: i18n.t("distance_desc"), value: "-distance" },
        { label: i18n.t("favourite_asc"), value: "-favourite,name" },
        { label: i18n.t("favourite_desc"), value: "favourite,name" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
      ];

    case "CountriesDropdown":
      return [
        { label: i18n.t("favourite_asc"), value: "-favourite,name" },
        { label: i18n.t("favourite_desc"), value: "favourite,name" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
      ];

    case "SpeciesDropdown":
      return [
        { label: i18n.t("seen_asc"), value: "-seen,name" },
        { label: i18n.t("seen_desc"), value: "seen,name" },
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
      ];

    case "Rating":
      return [
        { label: i18n.t("observation_count_desc"), value: "-observations" },
        { label: i18n.t("observation_count"), value: "observations" },
        { label: i18n.t("last_update_desc"), value: "-last_update" },
        { label: i18n.t("last_update_asc"), value: "last_update" },
      ];

    case "RatingsCompare":
      return [
        { label: i18n.t("taxonomic"), value: "ioc_id" },
        { label: i18n.t("taxonomic_desc"), value: "-ioc_id" },
        { label: i18n.t("alphabetic"), value: "name" },
        { label: i18n.t("alphabetic_desc"), value: "-name" },
      ];

    case "TimezonesDropdown":
      return [{ label: "Default", value: "name" }];

    default:
      return [];
  }
};
