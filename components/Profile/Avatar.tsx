import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { useProfile } from "../../store/profile-context";
import ProfileAvatar from "./ProfileAvatar";
import { useProfileDisplay } from "../../hooks/Profile/useProfileDisplay";
import { useInvalidateProfile } from "../../hooks/Profile/useUpdateProfile";
import { useMediaLibraryUnavailable } from "../../hooks/useMediaLibraryUnavailable";
import { BottomSheet } from "../../services/bottomSheet";
import { useApiError } from "../../hooks/useApiError";
import * as profileRepository from "../../hooks/repositories/profileRepository";
import * as avatarSync from "../../services/sync/avatarSync";

const AVATAR_SIZE = 100;

const Avatar = () => {
  const [avatar, setAvatar] = useState<string | null>();
  const [loading, setLoading] = useState(false);
  const invalidateProfile = useInvalidateProfile();

  const { profile } = useProfile();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { showErrorToast } = useApiError();

  const firstName = profile?.user_data?.first_name;
  const lastName = profile?.user_data?.last_name;
  const username = profile?.user_data?.username ?? "";
  const { fullName } = useProfileDisplay({ firstName, lastName, username });

  const handleMediaLibraryUnavailable = useMediaLibraryUnavailable();

  useEffect(() => {
    if (profile?.pendingAvatarOp === "upload") {
      setAvatar(profile.pendingAvatarUri ?? null);
    } else if (profile?.pendingAvatarOp === "delete") {
      setAvatar(null);
    } else {
      setAvatar(profile?.avatar_thumbnail ?? null);
    }
  }, [profile]);

  const onPress = () => {
    if (!avatar) {
      pickAvatar();
      return;
    }

    BottomSheet.showMenu({
      items: [
        {
          label: t("change_photo"),
          icon: "create-outline" as const,
          testID: "avatar-change-button",
          // A menu row does not dismiss the sheet by itself: without this the
          // system picker opens over a menu that is still there when it
          // closes. Its neighbour below deliberately does not hide — that one
          // replaces the menu with a confirmation in the same sheet.
          onPress: () => {
            BottomSheet.hide();
            pickAvatar();
          },
        },
        {
          label: t("remove_photo"),
          icon: "trash-outline" as const,
          danger: true,
          testID: "avatar-remove-button",
          onPress: () =>
            BottomSheet.show({
              title: t("remove_title"),
              description: t("delete_avatar_message"),
              confirmText: t("remove"),
              cancelText: t("cancel"),
              danger: true,
              onConfirm: () => removeAvatar(),
            }),
        },
      ],
    });
  };

  const pickAvatar = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { status: existingStatus } =
        await ImagePicker.getMediaLibraryPermissionsAsync();

      if (existingStatus === "denied") {
        handleMediaLibraryUnavailable();
        return;
      }

      if (existingStatus !== "granted") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      // Persist outside the cache dir so the pending upload survives an app
      // restart while offline (ImageManipulator's output otherwise lives in a
      // temp location the OS can purge).
      const persistedUri = `${FileSystem.documentDirectory}pending-avatar-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: manipulated.uri, to: persistedUri });

      profileRepository.queuePendingAvatar("upload", persistedUri);
      setAvatar(persistedUri);
      await avatarSync.runAvatarSync();
      invalidateProfile();
    } catch (e) {
      showErrorToast(e, "AvatarUpload");
    } finally {
      setLoading(false);
    }
  };

  const removeAvatar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      profileRepository.queuePendingAvatar("delete", null);
      setAvatar(null);
      await avatarSync.runAvatarSync();
      invalidateProfile();
    } catch (e) {
      showErrorToast(e, "AvatarDelete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Pressable style={styles.container} onPress={onPress} disabled={loading}>
        <ProfileAvatar
          avatar={avatar}
          firstName={firstName}
          lastName={lastName}
          username={username}
          size={AVATAR_SIZE}
        />
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary100} />
          </View>
        )}

        {!loading && (
          <View style={styles.plusWrapper}>
            <Ionicons name="pencil" size={16} color={Colors.textMain} />
          </View>
        )}
      </Pressable>
      {!avatar && !loading && (
        <Text style={styles.hintText}>↑ {t("tap_to_add_photo")}</Text>
      )}
      <Text style={styles.smallText}>{fullName}</Text>
    </>
  );
};

export default Avatar;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignSelf: "center",
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
    },
    placeholder: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: Colors.textMain,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarName: {
      fontSize: 36,
      color: Colors.primary100,
      fontWeight: "bold",
    },
    plusWrapper: {
      width: 26,
      height: 26,
      borderRadius: 13,
      position: "absolute",
      backgroundColor: Colors.primary100,
      borderColor: Colors.border,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
      bottom: -2,
      right: 2,
    },
    overlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: Colors.overlay,
      borderRadius: AVATAR_SIZE / 2,
      justifyContent: "center",
      alignItems: "center",
    },
    smallText: {
      marginTop: 8,
      textAlign: "center",
      fontSize: 12,
      color: Colors.textMain,
    },
    hintText: {
      marginTop: 4,
      textAlign: "center",
      fontSize: 11,
      color: Colors.main100,
    },
  });
