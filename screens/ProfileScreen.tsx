import { useState, useLayoutEffect } from "react";
import { TouchableOpacity, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import ProfileForm from "../components/Profile/ProfileForm";
import { useProfile } from "../store/profile-context";
import { showError } from "../services/api";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import FormWrapper from "../components/ui/FormWrapper";
import { useInvalidateProfile } from "../hooks/Profile/useUpdateProfile";
import { useTheme } from "../store/theme-context";
import { AppDrawerNavigationProp, AppError, ProfileFormData } from "../types";

const ProfileScreen = () => {
  const navigation = useNavigation<AppDrawerNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { profile, profileLoading, updateProfile, refreshProfile } =
    useProfile();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const invalidateProfile = useInvalidateProfile();
  const iconName = Platform.OS === "ios" ? "chevron-back" : "arrow-back";
  const headerHeight = useHeaderHeight();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("MainDrawer")}
          style={{ padding: 8 }}
          hitSlop={8}
        >
          <Ionicons name={iconName} size={24} color={Colors.textMain} />
        </TouchableOpacity>
      ),
      headerLeftContainerStyle: {
        paddingLeft: Platform.OS === "android" ? 8 : 0,
      },
    });
  }, [navigation, Colors, iconName]);

  const extractApiError = (e: AppError): { title: string; message: string } => {
    const data = e?.response?.data;
    const apiMessage = data
      ? data?.non_field_errors?.[0] ||
        data?.first_name?.[0] ||
        data?.last_name?.[0] ||
        data?.username?.[0] ||
        Object.values(data).flat().join("\n")
      : null;

    return {
      title: t("update_failed"),
      message: apiMessage || t("could_not_update_profile"),
    };
  };

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
      const error = e as AppError;
      showError(error, extractApiError);
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
      style={{ marginTop: 24, paddingTop: headerHeight }}
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
