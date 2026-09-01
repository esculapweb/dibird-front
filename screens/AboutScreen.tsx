import { Platform, Share } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import { Row, Section } from "../components/Settings/SettingsList";
import { useTheme } from "../store/theme-context";
import { AppDrawerNavigationProp } from "../types";
import { Config } from "../constants/config";
import { openSupportEmail } from "../util/openSupportEmail";
import { openDonatePage } from "../util/openDonatePage";
import { getFullVersion } from "../util/helpers";
import { track } from "../services/analytics";

// Everything a person opens once in the lifetime of the install: the ways to
// pass the app on, the ways to reach us, and the legal texts. It lives one level
// below Settings so that those six rows stop competing with the settings someone
// actually came to change.
const AboutScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const navigation = useNavigation<AppDrawerNavigationProp>();

  const handleTellAFriend = async () => {
    track("share_tapped", { type: "app" });
    await Share.share(
      Platform.OS === "ios"
        ? {
            url: `${Config.baseUrl}/`,
            message: t("tell_a_friend_message"),
          }
        : { message: t("tell_a_friend_message") },
    );
  };

  return (
    <Layout
      withScroll
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      bottom={
        <FlatButtonBottom textColor={Colors.textSecondary} disabled>
          {t("app_version", { version: getFullVersion() })}
        </FlatButtonBottom>
      }
    >
      <Section title={t("settings_section_support")}>
        <Row
          icon="share-social-outline"
          label={t("settings_tell_a_friend")}
          onPress={handleTellAFriend}
          hideChevron
        />
        <Row
          icon="chatbubble-outline"
          label={t("settings_send_feedback")}
          onPress={openSupportEmail}
          hideChevron
        />
        {/* Opens the site in the browser — see openDonatePage on why the wallets
            stay out of the app. */}
        <Row
          icon="heart-outline"
          label={t("settings_support_project")}
          onPress={() => openDonatePage("settings")}
          hideChevron
        />
      </Section>

      <Section title={t("settings_section_legal")}>
        <Row
          icon="shield-checkmark-outline"
          label={t("privacy_policy")}
          onPress={() => navigation.navigate("Privacy")}
        />
        <Row
          icon="document-text-outline"
          label={t("terms_of_service")}
          onPress={() => navigation.navigate("Terms")}
        />
      </Section>
    </Layout>
  );
};

export default AboutScreen;
