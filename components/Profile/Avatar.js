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

import Toast from "react-native-toast-message";
import { Colors } from "../../constants/styles";
import { patchAvatar, deleteAvatar } from "../../util/requests";

const AVATAR_SIZE = 100;

const Avatar = ({ data, avatarName }) => {
  const { showActionSheetWithOptions } = useActionSheet();
  const [avatar, setAvatar] = useState();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAvatar(data?.avatar_thumbnail ?? data?.avatar);
  }, [data]);

  const onPress = () => {
    if (!avatar) {
        pickAvatar();
        return;
    }

    showActionSheetWithOptions(
      {
        options: ["Change photo", "Remove photo", "Cancel"],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) pickAvatar();
        if (index === 1) removeAvatar();
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
        text1: "Permission denied",
        text2: "Allow access to your photos",
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

      const responseData = await patchAvatar(manipulated);
      setAvatar(responseData.avatar_thumbnail);
    } catch (err) {
      console.log("Image manipulation error:", err);
      Toast.show({
        type: "error",
        text1: "Image processing failed",
      });
    }
    setLoading(false);
  };

  const removeAvatar = async () => {
    setLoading(true);
    const res = await deleteAvatar();
    if (res.status === 204) setAvatar(null);
    setLoading(false);
  };

  return (
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
          <Ionicons name="pencil" size={16} color={Colors.accent} />
        </View>
      )}
    </Pressable>
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
});
