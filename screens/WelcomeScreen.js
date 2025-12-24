import { StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import Profile from "./Profile";
import api from "../services/api";

const WelcomeScreen = () => {
  const [fetchedMessage, setFetchedMessage] = useState();

  useEffect(() => {
    const fetchResponse = async () => {
      const response = await api.get("/myapi/profile/me/");
      console.log("fetched");
      console.log(response.data);
      setFetchedMessage(response.data);
    };
    fetchResponse();
  }, []);

  return (
    <Profile data={fetchedMessage} />
  );
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
