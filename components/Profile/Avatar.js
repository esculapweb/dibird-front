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
import { Ionicons } from "@expo/vector-icons";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { useTranslation } from "react-i18next";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { patchAvatar } from "../../util/requests";

import { useProfile } from "../../store/profile-context";
import api, { showError } from "../../services/api";
import ProfileAvatar from "./ProfileAvatar";
import { useProfileDisplay } from "../../hooks/Profile/useProfileDisplay";
import { useInvalidateProfile } from "../../hooks/Profile/useUpdateProfile";
import { useMediaLibraryUnavailable } from "../../hooks/useMediaLibraryUnavailable";

const AVATAR_SIZE = 100;

const Avatar = () => {
  const { showActionSheetWithOptions } = useActionSheet();
  const [avatar, setAvatar] = useState();
  const [loading, setLoading] = useState(false);
  const invalidateProfile = useInvalidateProfile();

  const { refreshProfile, profile } = useProfile();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const firstName = profile?.user_data?.first_name;
  const lastName = profile?.user_data?.last_name;
  const username = profile?.user_data?.username ?? "";
  const { fullName } = useProfileDisplay({ firstName, lastName, username });

  const handleMediaLibraryUnavailable = useMediaLibraryUnavailable();

  useEffect(() => {
    setAvatar(profile?.avatar_thumbnail ?? null);
  }, [profile]);

  const onPress = () => {
    if (!avatar) {
      pickAvatar();
      return;
    }

    showActionSheetWithOptions(
      {
        options: [t("change_photo"), t("remove_photo"), t("cancel")],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (index) => {
        switch (index) {
          case 0:
            pickAvatar();
            break;
          case 1:
            removeAvatar();
            break;
          case 2:
          default:
            break;
        }
      },
    );
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

      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

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

      const { avatar_thumbnail } = await patchAvatar(manipulated);
      setAvatar(avatar_thumbnail);
      refreshProfile();
      invalidateProfile();
    } catch (e) {
      console.warn("Image manipulation error:", e.code, e.message);
      showError(e);
    } finally {
      setLoading(false);
    }
  };

  const removeAvatar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.delete("/myapi/profile/avatar/");
      if (res?.status === 204) {
        refreshProfile();
        setAvatar(null);
        invalidateProfile();
      }
    } catch (e) {
      console.warn("Delete Avatar error:", e.code, e.message);
      showError(e);
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
      ...StyleSheet.absoluteFillObject,
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
  });
