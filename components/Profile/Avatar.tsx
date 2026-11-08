import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
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
import { BottomSheet } from "../../services/bottomSheet";
import { useApiError } from "../../hooks/useApiError";
import * as profileRepository from "../../hooks/repositories/profileRepository";
import * as avatarSync from "../../services/sync/avatarSync";

const AVATAR_SIZE = 100;

// The avatar is shown at most AVATAR_SIZE pt (~300 px at @3x) and the backend
// crops its thumbnails to a square, so the shorter side is what matters.
export const AVATAR_UPLOAD_MIN_SIDE = 512;

// Scale the shorter side down to AVATAR_UPLOAD_MIN_SIDE, never up: a photo
// that is already small is left as is. Width and height of 0 mean the picker
// did not report them — then do not guess.
export const avatarResize = (
  width: number,
  height: number,
): ImageManipulator.Action[] => {
  const shorter = Math.min(width, height);
  if (!shorter || shorter <= AVATAR_UPLOAD_MIN_SIDE) return [];
  return [
    {
      resize:
        width <= height
          ? { width: AVATAR_UPLOAD_MIN_SIDE }
          : { height: AVATAR_UPLOAD_MIN_SIDE },
    },
  ];
};

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
      // No permission gate before the picker: launchImageLibraryAsync needs
      // none (expo's own docs say "requires MEDIA_LIBRARY on iOS 10 only", and
      // on Android 13+ expo-image-picker asks for an empty permission list
      // anyway — the system photo picker is trusted UI and hands back only what
      // was picked). Asking regardless only did harm: on iOS it is what offered
      // "Selected Photos" in the first place, and on Android 12 and older a
      // declined storage permission blocked a picker that would have opened
      // without it.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        // iOS is the only platform that pays for allowsEditing: expo-image-picker
        // answers it with the legacy UIImagePickerController instead of PHPicker
        // (see its launchImagePicker), and that one is confined to the app's
        // photo-library authorization — for anyone who ever granted limited
        // access, a handful of photos and no albums at all. Nothing is lost:
        // the square comes from the backend thumbnail (crop) and ProfileAvatar's
        // contentFit "cover". Android runs its cropper as a separate activity
        // after the system picker, so there the editing step is free.
        allowsEditing: Platform.OS !== "ios",
        aspect: [1, 1],
        // Full quality here: the one JPEG compression happens below, after the
        // resize. Compressing in both places re-encoded the photo twice and
        // still uploaded it at full camera resolution (#471).
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        avatarResize(asset.width, asset.height),
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
      <Pressable
        style={styles.container}
        onPress={onPress}
        disabled={loading}
        testID="profile-avatar-button"
      >
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
