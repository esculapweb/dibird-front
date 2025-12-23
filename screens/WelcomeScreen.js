import { StyleSheet, Text, View } from "react-native";
import axios from "axios";
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../store/auth-context";
import Profile from "./Profile";

const WelcomeScreen = () => {
  const [fetchedMessage, setFetchedMessage] = useState();
  const authCtx = useContext(AuthContext);
  const token = authCtx.token;

  useEffect(() => {
    const fetchResponse = async () => {
      try {
        const response = await axios.get(
          "http://192.168.0.102:8000/myapi/profile/me/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("fetched");
        console.log(response.data);
        setFetchedMessage(response.data);
      } catch (e) {
        console.log("error in fetch");
        console.log(e.response.data);
      }
    };
    fetchResponse();
  }, [token]);

  return (
    <Profile data={fetchedMessage} />
    // <View style={styles.rootContainer}>
    //   <Text style={styles.title}>Welcome!</Text>
    //   <Text>You are authenticated successfully!</Text>
    //   <Text>{JSON.stringify(fetchedMessage, null, 2)}</Text>
    // </View>
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
