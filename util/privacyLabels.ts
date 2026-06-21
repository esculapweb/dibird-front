import i18n from "../services/i18n";
import { IconType } from "../types";

type privacyItemType = [string, string, IconType]

export const privacyLabels = (descriptionType: string | undefined): Record<"private" | "public", privacyItemType>  => {
  switch (descriptionType) {
    case "male":
      return {
        private: [i18n.t("private_male"), i18n.t("visible_only_to_you"), "lock-closed"],
        public: [i18n.t("public_male"), i18n.t("visible_to_everyone"), "globe-outline"],
      };
    case "multiple":
      return {
        private: [i18n.t("private_multiple"), i18n.t("visible_only_to_you"), "lock-closed"],
        public: [i18n.t("public_multiple"), i18n.t("visible_to_everyone"), "globe-outline"],
      };
    case "location":
      return {
        private: [i18n.t("private_location"), i18n.t("location_only_to_you"), "eye-off-outline"],
        public: [i18n.t("public_location"), i18n.t("location_to_everyone"), "location-outline"],
      };

    default:
      return {
        private: [i18n.t("private"), i18n.t("visible_only_to_you"), "lock-closed"],
        public: [i18n.t("public"), i18n.t("visible_to_everyone"), "globe-outline"],
      };
  }
};
