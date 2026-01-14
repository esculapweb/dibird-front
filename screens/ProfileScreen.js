import { useState } from "react";
import { StyleSheet, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/Profile/ProfileForm";
import { useProfile } from "../store/profile-context";
import { mapErrorToToast } from "../services/api";

const ProfileScreen = ({ refreshKey }) => {
  const [loading, setLoading] = useState(false);
  const profileCtx = useProfile();
  const { t } = useTranslation();

  const extractApiError = (err) => {
    const data = err.response.data;
    if (!data) return null;
    const apiMessage =
      data?.non_field_errors?.[0] ||
      data?.first_name?.[0] ||
      data?.last_name?.[0] ||
      data?.username?.[0] ||
      Object.values(data).flat().join("\n");
    return {
      title: t("update_failed"),
      message: apiMessage || t("could_not_update_profile"),
    };
  };

  const submitHandler = async (updatedData) => {
    if (loading) return;
    setLoading(true);
    try {
      await profileCtx.updateProfile(updatedData);
    } catch (e) {
      const { title, message } = mapErrorToToast(e, extractApiError);
      Toast.show({
        type: "error",
        text1: title,
        text2: message,
      });
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
      <ProfileForm
        submitHandler={submitHandler}
        loading={loading}
        key={refreshKey}
      />
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
