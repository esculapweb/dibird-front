import { useState } from "react";
import { StyleSheet, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import ProfileForm from "../components/Profile/ProfileForm";
import { useProfile } from "../store/profile-context";

const ProfileScreen = ({refreshKey}) => {
  const [loading, setLoading] = useState(false);
  const profileCtx = useProfile();

  const submitHandler = async (updatedData) => {
    if (loading) return;
    setLoading(true);
    try {
      await profileCtx.updateProfile(updatedData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      enableOnAndroid
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
    >
      <ProfileForm submitHandler={submitHandler} loading={loading} key={refreshKey} />
    </KeyboardAwareScrollView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
  },
});
