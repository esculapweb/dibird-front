import { View, Text, StyleSheet } from "react-native";
import { Image, ImageStyle } from "expo-image";
import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useProfileDisplay } from "../../hooks/Profile/useProfileDisplay";

interface ProfileAvatarProps {
  avatar?: string | null;
  firstName?: string;
  lastName?: string;
  username: string;
  size: number;
  borderRadius?: number;
  style?: ImageStyle;
}

const ProfileAvatar = ({
  avatar,
  firstName,
  lastName,
  username,
  size = 44,
  borderRadius,
  style,
}: ProfileAvatarProps) => {
  const { Colors } = useTheme();
  const { initials } = useProfileDisplay({ firstName, lastName, username });
  const radius = borderRadius ?? size / 2;
  const styles = stylesFn(Colors, size, radius);

  return avatar ? (
    <Image
      source={{
        // Pending offline uploads pass a local `file://` URI (see
        // FileSystem.documentDirectory in Avatar.tsx) which must be used
        // as-is; only a bare relative path from the server needs prefixing.
        uri: avatar.includes("://") ? avatar : `${Config.mediaUrl}/${avatar}`,
      }}
      style={[styles.avatar, style]}
      contentFit="cover"
      cachePolicy="disk"
    />
  ) : (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
};

export default ProfileAvatar;

const stylesFn = (Colors: ThemeColors, size: number, borderRadius: number) =>
  StyleSheet.create({
    avatar: {
      width: size,
      height: size,
      borderRadius,
    },
    placeholder: {
      width: size,
      height: size,
      borderRadius,
      backgroundColor: Colors.textMain,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: {
      fontSize: size * 0.4,
      color: Colors.primary100,
      fontWeight: "bold",
    },
  });
