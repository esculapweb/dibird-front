import Toast from "react-native-toast-message";
import api from "../services/api";

export const Put = async (url, data, message) => {
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
  } catch (error) {
    if (error.response) {
      console.error("Validation error:", error.response.data);
      Toast.show({
        type: "error",
        text1: "Check entered data",
      });
    } else {
      console.error("Network error:", error.message);
      Toast.show({
        type: "error",
        text1: "Server unavailable",
      });
    }
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
  } catch (error) {
    if (error.response) {
      console.error("Validation error:", error.response.data);
      Toast.show({
        type: "error",
        text1: "Something went wrong",
      });
    } else {
      console.error("Network error:", error.message);
      Toast.show({
        type: "error",
        text1: "Server unavailable",
      });
    }
  }
};

export const deleteAvatar = () => {
  try {
    return api.delete("/myapi/profile/avatar/");
  } catch (error) {
    console.error(
      "Delete Avatar error:",
      error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message ?? error
    );

    Toast.show({
      type: "error",
      text1: "Failed to remove avatar",
    });
  }
};
