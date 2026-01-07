import Toast from "react-native-toast-message";
import api from "../services/api";

export const Put = async (url, data, message) => {
  try {
    const response = await api.put(url, data);

    if (response.status === 200 || response.status === 204) {
      console.log(message, response.data);
      Toast.show({
        type: "success",
        text1: message,
      });
    }
  } catch (error) {
    if (error.response) {
      console.log("Validation error:", error.response.data);
      Toast.show({
        type: "error",
        text1: "Check entered data",
      });
    } else {
      console.log("Network error:", error.message);
      Toast.show({
        type: "error",
        text1: "Server unavailable",
      });
    }
  }
};
