import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import ProfileForm from "../components/Profile/ProfileForm";
import FailedEditBanner from "../components/Profile/FailedEditBanner";
import { useProfile } from "../store/profile-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import FormWrapper from "../components/ui/FormWrapper";
import { useInvalidateProfile } from "../hooks/Profile/useUpdateProfile";
import { AppError, ErrorExtractor, ProfileFormData } from "../types";
import { useApiError } from "../hooks/useApiError";

const ProfileScreen = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);
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
    setSuccess(false);

    try {
      await updateProfile(updatedData);
      invalidateProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } catch (e) {
      showErrorToast(e as AppError, "updateProfile", extractApiError);
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
      style={{ paddingTop: 24 }}
    >
      {failedEdit && (
        <FailedEditBanner
          failedEdit={failedEdit}
          onRetry={retryFailedEdit}
          onDiscard={discardFailedEdit}
        />
      )}
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
