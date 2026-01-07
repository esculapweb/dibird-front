import { useState, useEffect } from "react";
import { StyleSheet, View, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";

import Toast from "react-native-toast-message";
import api from "../../services/api";

const Avatar = ({ data }) => {
  const [avatar, setAvatar] = useState();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAvatar(data?.avatar_thumbnail ?? data?.avatar);
  }, [data]);

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

      await uploadAvatar(manipulated);
    } catch (err) {
      console.log("Image manipulation error:", err);
      Toast.show({
        type: "error",
        text1: "Image processing failed",
      });
    }
    setLoading(false);
  };

  const uploadAvatar = async (image) => {
    const formData = new FormData();
    const message = "Avatar updated";

    formData.append("avatar", {
      uri: image.uri,
      name: "avatar.jpg",
      type: "image/jpeg",
    });

    try {
      const response = await api.patch("/myapi/profile/avatar/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200 || response.status === 204) {
        setAvatar(response.data.avatar_thumbnail);
        Toast.show({
          type: "success",
          text1: message,
        });
      }
    } catch (error) {
      if (error.response) {
        console.log("Validation error:", error.response.data);
        Toast.show({
          type: "error",
          text1: "Check entered data",
        });
      } else {
        console.log("Network error:", error.message);
        Toast.show({
          type: "error",
          text1: "Server unavailable",
        });
      }
    }
  };

  return (
    <>
      <View style={styles.container}>
        {avatar && (
          <Image
            source={{
              uri: avatar,
            }}
            style={styles.image}
          />
        )}
      </View>
      <View style={styles.buttons}>
        <AnimatedLoadingButton onPress={pickAvatar} loading={loading}>
          Update avatar
        </AnimatedLoadingButton>
      </View>
    </>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 150,
    height: 150,
    resizeMode: "contain",
  },
  buttons: {
    marginTop: 18,
  },
});
