import Toast from "react-native-toast-message";

import i18n from "../services/i18n";
import api  from "../services/api";

export const Put = async (url, data, message) => {
  try {
    const response = await api.put(url, data);

    if (response.status === 200 || response.status === 204) {
      Toast.show({
        type: "success",
        text1: message,
      });
      return response;
    }
    throw new Error(`Unexpected status: ${response.status}`);
  } catch (e) {
    throw e;
  }
};

export const patchAvatar = async (image) => {
  const formData = new FormData();

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
  } catch (e) {
    if (e.response) {
      console.warn("Validation error:", e.response.data);
      Toast.show({
        type: "error",
        text1: i18n.t("something_went_wrong"),
      });
    } else {
      console.warn("Network error:", e.message);
      Toast.show({
        type: "error",
        text1: i18n.t("server_unavailable"),
      });
    }
  }
};

export const deleteAvatar = () => {

  try {
    return api.delete("/myapi/profile/avatar/");
  } catch (e) {
    console.warn(
      "Delete Avatar error:",
      e?.response?.data
        ? JSON.stringify(e.response.data)
        : e?.message ?? e
    );

    Toast.show({
      type: "error",
      text1: i18n.t("failed_remove_avatar"),
    });
  }
};
