import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";

import api from "../services/api";

export const Put = async (url, data, message) => {
  const { t } = useTranslation();

  try {
    const response = await api.put(url, data);

    if (response.status === 200 || response.status === 204) {
      // console.info(message, response.data);
      Toast.show({
        type: "success",
        text1: message,
      });
      return response;
    }
    throw new Error(`Unexpected status: ${response.status}`);
  } catch (error) {
    if (error.response) {
      console.warn("Validation error:", error.response.data);
      Toast.show({
        type: "error",
        text1: t("check_entered_data"),
      });
    } else {
      console.warn("Network error:", error.message);
      Toast.show({
        type: "error",
        text1: t("server_unavailable"),
      });
    }
    return null;
  }
};

export const patchAvatar = async (image) => {
  const formData = new FormData();
  const { t } = useTranslation();

  formData.append("avatar", {
    uri: image.uri,
    name: "avatar.jpg",
    type: "image/jpeg",
  });

  try {
    const response = await api.patch("/myapi/profile/avatar/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.status === 200 || response.status === 204) {
      return response.data;
    }
  } catch (error) {
    if (error.response) {
      console.warn("Validation error:", error.response.data);
      Toast.show({
        type: "error",
        text1: t("something_went_wrong"),
      });
    } else {
      console.warn("Network error:", error.message);
      Toast.show({
        type: "error",
        text1: t("server_unavailable"),
      });
    }
  }
};

export const deleteAvatar = () => {
  const { t } = useTranslation();

  try {
    return api.delete("/myapi/profile/avatar/");
  } catch (error) {
    console.warn(
      "Delete Avatar error:",
      error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message ?? error
    );

    Toast.show({
      type: "error",
      text1: t("failed_remove_avatar"),
    });
  }
};
