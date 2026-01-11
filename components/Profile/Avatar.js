import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Image,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { useTranslation } from "react-i18next";

import Toast from "react-native-toast-message";
import { Colors } from "../../constants/styles";
import { patchAvatar, deleteAvatar } from "../../util/requests";

import { useProfile } from "../../store/profile-context";

const AVATAR_SIZE = 100;

const Avatar = () => {
  const { showActionSheetWithOptions } = useActionSheet();
  const [avatar, setAvatar] = useState();
  const [avatarName, setAvatarName] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const profileCtx = useProfile();
  const { t } = useTranslation();

  useEffect(() => {
    setAvatar(profileCtx.profile?.avatar_thumbnail ?? null);
  }, [profileCtx.profile]);

  useEffect(() => {
    const user_data = profileCtx.profile?.user_data;
    if (!user_data) return;

    const { first_name, last_name, username } = user_data;
    const n =
      first_name && last_name
        ? `${first_name[0]}${last_name[0]}`
        : username.slice(0, 2);
    setAvatarName(n.toUpperCase());

    first_name && last_name
      ? setName(`${first_name} ${last_name}`)
      : setName(username);
  }, [profileCtx.profile]);

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
      }
    );
  };

  const pickAvatar = async () => {
    if (loading) return;
    setLoading(true);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Toast.show({
        type: "error",
        text1: t("permission_denied"),
        text2: t("allow_access_photo"),
      });
      setLoading(false);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      setLoading(false);
      return;
    }

    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const { avatar_thumbnail } = await patchAvatar(manipulated);
      setAvatar(avatar_thumbnail);
      profileCtx.refreshProfile();
    } catch (err) {
      console.warn("Image manipulation error:", err);
      Toast.show({
        type: "error",
        text1: t("image_processing_failed"),
      });
    }
    setLoading(false);
  };

  const removeAvatar = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await deleteAvatar();
      if (res?.status === 204) {
        profileCtx.refreshProfile();
        setAvatar(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Pressable style={styles.container} onPress={onPress} disabled={loading}>
        {avatar ? (
          <Image
            source={{
              uri: avatar,
            }}
            style={styles.avatar}
          />
        ) : (
          !loading && (
            <View style={styles.placeholder}>
              <Text style={styles.avatarName}>{avatarName}</Text>
            </View>
          )
        )}

        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator
              size="large"
              color="#fff"
              style={{ transform: [{ translateY: 1 }] }}
            />
          </View>
        )}

        {!loading && (
          <View style={styles.plusWrapper}>
            <Ionicons name="pencil" size={16} color={Colors.primary500} />
          </View>
        )}
      </Pressable>
      <Text style={styles.smallText}>{name}</Text>
    </>
  );
};

export default Avatar;

const styles = StyleSheet.create({
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
    backgroundColor: Colors.primary500,
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
    borderRadius: 15,
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: AVATAR_SIZE / 2,
  },
  smallText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 12,
    color: Colors.primary500,
  },
});
