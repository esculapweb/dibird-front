import { StyleSheet } from "react-native";
import { useEffect, useState } from "react";

import Profile from "./Profile";
import api from "../services/api";

const WelcomeScreen = () => {
  const [fetchedMessage, setFetchedMessage] = useState();

  const fetchResponse = async () => {
      const response = await api.get("/myapi/profile/me/");
      setFetchedMessage(response.data);
    };

  useEffect(() => {
    fetchResponse();
  }, []);
  
  const submitHandler = async (updatedData) => {
    const response = await api.put("/myapi/profile/");
    console.log("Submit data:", updatedData);
  };

  return (
    <Profile data={fetchedMessage} submitHandler={submitHandler} />
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
