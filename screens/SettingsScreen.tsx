import { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTranslation } from "react-i18next";

import api, { clearTokens } from "../services/api";
import Layout from "../components/ui/Layout";
import ConfirmBottomSheet, {
  ConfirmBottomSheetRef,
} from "../components/ui/ConfirmBottomSheet";
import { useFilters } from "../store/filters-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeColors, useTheme } from "../store/theme-context";
import { useProfile } from "../store/profile-context";
import { useAuth } from "../store/auth-context";
import { showError } from "../services/api";
import { AppError } from "../types";

const SettingsScreen = () => {
  const headerHeight = useHeaderHeight();
  const { resetFilters } = useFilters();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { logout } = useAuth(); // добавить

  const { profile } = useProfile();
  const userEmail = profile?.user_data?.email ?? "";

  const deleteSheetRef = useRef<ConfirmBottomSheetRef>(null);

  const clearAll = async () => {
    await clearTokens();
    await AsyncStorage.multiRemove(["profile", "filters", "sorting", "global"]);
    await resetFilters();
    queryClient.clear();
  };

  const handleDeleteConfirmed = async () => {
    const res = await api.delete("/myapi/profile/delete-me/");
    if (res?.status === 204) {
      await clearAll();
      await logout();
    }
  };

  return (
    <Layout style={{ marginTop: 24, paddingTop: headerHeight }}>
      <View style={styles.section}>
        {/* ... other settings ... */}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteSheetRef.current?.present(null)}
        >
          <Text style={[styles.deleteButtonText, { color: Colors.error600 }]}>
            {t("delete_profile")}
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmBottomSheet
        ref={deleteSheetRef}
        danger
        title={t("delete_profile_title")}
        description={t("delete_profile_warning")}
        confirmText={t("delete_confirm_button")}
        cancelText={t("cancel")}
        requiredInput={userEmail}
        inputPlaceholder={userEmail}
        onConfirm={handleDeleteConfirmed}
        onError={(e) => showError(e as AppError)}
        inputLabel={t("delete_profile_input_label")}
      />
    </Layout>
  );
};

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: 16,
      gap: 12,
    },
    deleteButton: {
      marginTop: 32,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.error600,
      alignItems: "center",
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: "500",
    },
  });

export default SettingsScreen;
