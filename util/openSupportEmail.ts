import { Linking } from "react-native";
import Toast from "react-native-toast-message";

import { Config } from "../constants/config";
import i18n from "../services/i18n";
import { AppError } from "../types";

const handleError = () => {
    Toast.show({
      type: "error",
      text1: i18n.t("no_mail_app"),
      text2: i18n.t("please_contact_us_at", { email: Config.email }),
    });
}

export const openSupportEmail = async () => {
  try {
    const emailUrl = `mailto:${Config.email}?subject=${encodeURIComponent("Support Request - [DiBird]")}`;

    const canOpen = await Linking.canOpenURL(emailUrl);

    if (canOpen) {
      await Linking.openURL(emailUrl);
    } else {
      handleError();
    }
  } catch(e) {
    const error =  e as AppError;
    console.error('[openSupportEmail]', error);
    handleError();
  }
};
