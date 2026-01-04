import { StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import Toast from "react-native-toast-message";

import Profile from "./Profile";
import api from "../services/api";

const WelcomeScreen = () => {
  const [fetchedMessage, setFetchedMessage] = useState();
  const [loading, setLoading] = useState(false);

  const fetchResponse = async () => {
    const response = await api.get("/myapi/profile/me/");
    setFetchedMessage(response.data);
  };

  useEffect(() => {
    fetchResponse();
  }, []);

  const submitHandler = async (updatedData, userId) => {
    if (loading) return;

    try {
      setLoading(true);
      const response = await api.put(`/myapi/profile/${userId}/`, updatedData);

      if (response.status === 200 || response.status === 204) {
        console.log("Profile updated:", response.data);
        Toast.show({
          type: "success",
          text1: "Profile updated",
          onPress: () => Toast.hide(),
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
    } finally {
      setLoading(false);
    }
  };

  return <Profile data={fetchedMessage} submitHandler={submitHandler} loading={loading} />;
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
});
