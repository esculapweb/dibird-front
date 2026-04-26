import i18n from "../services/i18n";

export const privacyLabels = (gender: string | undefined) => {
  switch (gender) {
    case "male":
      return {
        private: i18n.t("private_male"),
        public: i18n.t("public_male"),
      };
    case "multiple":
      return {
        private: i18n.t("private_multiple"),
        public: i18n.t("public_multiple"),
      };

    default:
      return {
        private: i18n.t("private"),
        public: i18n.t("public"),
      };
  }
};
