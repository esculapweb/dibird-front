import { useEffect, useState } from "react";
import {
  StyleSheet,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";


import ProfileForm from "../components/Profile/ProfileForm";
import Avatar from "../components/Profile/Avatar";
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
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      enableOnAndroid
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
    >
        {/* <ProfileForm
          data={fetchedMessage}
          submitHandler={submitHandler}
          loading={loading}
        /> */}
        <Avatar data={fetchedMessage} />
    </KeyboardAwareScrollView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
  },
});
