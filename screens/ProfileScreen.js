import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/Profile/ProfileForm";
import { useProfile } from "../store/profile-context";
import { showError } from "../services/api";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import FormWrapper from "../components/ui/FormWrapper";
import { useInvalidateProfile } from "../hooks/Profile/useUpdateProfile";

const ProfileScreen = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { profile, profileLoading, updateProfile, refreshProfile } =
    useProfile();
  const { t } = useTranslation();
  const invalidateProfile = useInvalidateProfile();

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
      invalidateProfile();
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
    return (
      <ErrorOverlay
        title={t("profile_unavailable")}
        message={t("could_not_load_your_profile")}
        onPress={refreshProfile}
      />
    );

  return (
    <FormWrapper
      bottomButtonLabel={t("reset_form")}
      bottomButtonHandler={() => setFormKey((k) => k + 1)}
      style={{marginTop: 24}}
    >
      <ProfileForm
        key={formKey}
        submitHandler={submitHandler}
        loading={loading}
        success={success}
      />
    </FormWrapper>
  );
};

export default ProfileScreen;
