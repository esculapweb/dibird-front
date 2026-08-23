import { Linking } from "react-native";
import Toast from "react-native-toast-message";

import { track, DonateSource } from "../services/analytics";
import { logError } from "../services/errors";
import i18n from "../services/i18n";
import { langBaseUrl } from "./helpers";

export const DONATE_PATH = "page/donate/";

/**
 * The donation page is opened in the browser rather than shown in the app on
 * purpose: wallet addresses inside the binary are what App Review reads as
 * collecting payments outside IAP (guidelines 3.1.1 / 3.2.1), while a link out
 * to the project's own site is an ordinary external link.
 */
export const openDonatePage = async (source: DonateSource) => {
  track("donate_tapped", { source });

  try {
    await Linking.openURL(`${langBaseUrl()}/${DONATE_PATH}`);
  } catch (e) {
    logError(e, "openDonatePage");
    Toast.show({
      type: "error",
      text1: i18n.t("something_went_wrong"),
    });
  }
};
