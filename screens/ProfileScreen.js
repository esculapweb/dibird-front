import { useState } from "react";
import { StyleSheet, Platform, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/Profile/ProfileForm";
import { useProfile } from "../store/profile-context";
import { showError } from "../services/api";
import { Colors } from "../constants/styles";

const ProfileScreen = () => {
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
      showError(e, extractApiError);
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
        style={{ flex: 1 }}
      >
          <ProfileForm
            submitHandler={submitHandler}
            loading={loading}
          />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  container: {
    flexGrow: 1,
  },
});
