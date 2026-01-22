import { useState } from "react";
import { StyleSheet, Platform, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/Profile/ProfileForm";
import { useProfile } from "../store/profile-context";
import { showError } from "../services/api";
import { Colors } from "../constants/styles";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";

const ProfileScreen = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { profile, profileLoading, updateProfile, refreshProfile } =
    useProfile();
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
    setSuccess(false);

    try {
      await updateProfile(updatedData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } catch (e) {
      showError(e, extractApiError);
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) return <LoadingOverlay />;

  if (!profile) 
    return <ErrorOverlay title={t("profile_unavailable")} message={t("could_not_load_your_profile")} onPress={refreshProfile}/>;

  return (
    <View style={styles.safeArea}>
      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.container}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
          style={{ flex: 1 }}
        >
          <ProfileForm
            key={formKey}
            submitHandler={submitHandler}
            loading={loading}
            success={success}
          />
        </KeyboardAwareScrollView>

        <FlatButtonBottom onPress={() => setFormKey((k) => k + 1)}>
          {t("reset_form")}
        </FlatButtonBottom>
      </View>
    </View>
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
    paddingBottom: 80,
  },
});
