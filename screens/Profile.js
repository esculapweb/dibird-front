import { useEffect, useState } from "react";
import { StyleSheet, ScrollView } from "react-native";

import ProfileForm from "../components/Profile/ProfileForm";
import api from "../services/api";
import { Put } from "../util/requests";

const Profile = () => {
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
    setLoading(true);
    const url = `/myapi/profile/${userId}/`;
    await Put(url, updatedData, "Profile updated");
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <ProfileForm
        data={fetchedMessage}
        submitHandler={submitHandler}
        loading={loading}
      />
    </ScrollView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
});
