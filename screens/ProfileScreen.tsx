import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import ProfileForm from "../components/Profile/ProfileForm";
import FailedEditBanner from "../components/Profile/FailedEditBanner";
import { useProfile } from "../store/profile-context";
import ProfileSkeleton from "../components/Profile/ProfileSkeleton";
import Layout from "../components/ui/Layout";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import FormWrapper from "../components/ui/FormWrapper";
import { useInvalidateProfile } from "../hooks/Profile/useUpdateProfile";
import { AppError, ErrorExtractor, ProfileFormData } from "../types";
import { useApiError } from "../hooks/useApiError";

const ProfileScreen = () => {
  const [loading, setLoading] = useState(false);
  const {
    profile,
    profileLoading,
    updateProfile,
    refreshProfile,
    failedEdit,
    retryFailedEdit,
    discardFailedEdit,
  } = useProfile();
  const { t } = useTranslation();
  const invalidateProfile = useInvalidateProfile();
  const { showErrorToast } = useApiError();

const extractApiError = useCallback<ErrorExtractor>(
  (err) => {
    const data = err.response?.data;
    const message = data
      ? data?.non_field_errors?.[0] ||
        data?.first_name?.[0] ||
        data?.last_name?.[0] ||
        data?.username?.[0] ||
        Object.values(data).flat().join("\n")
      : null;

    return {
      title: t("update_failed"),
      message: message || t("could_not_update_profile"),
    };
  },
  [t],
);

  const submitHandler = async (updatedData: ProfileFormData) => {
    if (loading) return;

    setLoading(true);

    try {
      await updateProfile(updatedData);
      invalidateProfile();
      // The header icon has no success state of its own (the bottom button
      // used to animate one), and the screen stays open after saving — so the
      // confirmation is a toast.
      Toast.show({ type: "success", text1: t("profile_saved") });
    } catch (e) {
      showErrorToast(e as AppError, "updateProfile", extractApiError);
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading)
    return (
      <Layout>
        <ProfileSkeleton />
      </Layout>
    );

  if (!profile)
    return (
      <ErrorOverlay
        title={t("profile_unavailable")}
        message={t("could_not_load_your_profile")}
        onPress={refreshProfile}
      />
    );

  return (
    <FormWrapper style={{ paddingTop: 24 }}>
      {failedEdit && (
        <FailedEditBanner
          failedEdit={failedEdit}
          onRetry={retryFailedEdit}
          onDiscard={discardFailedEdit}
        />
      )}
      <ProfileForm submitHandler={submitHandler} loading={loading} />
    </FormWrapper>
  );
};

export default ProfileScreen;
