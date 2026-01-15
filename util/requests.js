import Toast from "react-native-toast-message";

import api from "../services/api";

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

    if (response.status === 200 || response.status === 204)
      return response.data;
    throw new Error(`Unexpected status code: ${response.status}`);
  } catch (e) {
    throw e;
  }
};
