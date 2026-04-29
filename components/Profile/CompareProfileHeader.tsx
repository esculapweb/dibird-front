// CompareProfileHeader.js
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme, ThemeColors } from "../../store/theme-context";
import ProfileAvatar from "./ProfileAvatar";
import { useProfileDisplay } from "../../hooks/Profile/useProfileDisplay";
import { OwnerData } from "../../types";

const ProfileColumn = ({ profile, color }: {profile: OwnerData, color: string;}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { shortName } = useProfileDisplay({
    firstName: profile.first_name,
    lastName: profile.last_name,
    username: profile.username,
  });

  return (
    <View style={styles.profileCol}>
      <View style={styles.avatarWrap}>
        <ProfileAvatar
          avatar={profile.avatar}
          firstName={profile.first_name}
          lastName={profile.last_name}
          username={profile.username}
          size={42}
        />
        <View style={[styles.colorDot, { backgroundColor: color }]} />
      </View>
      <Text style={styles.profileName} numberOfLines={1}>
        {shortName}
      </Text>
      <Text style={[styles.profileCount, { color }]}>
        {profile.count}
      </Text>
    </View>
  );
};

const CompareProfileHeader = ({ profileData, counts }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  if (!profileData || profileData.length < 2) return null;

  const profiles = profileData.map((p, i) => ({
    ...p,
    count: counts?.profile?.[i] ?? 0,
  }));

  return (
    <View style={styles.container}>
      <ProfileColumn profile={profiles[0]} color={Colors.compareP1} />

      <View style={styles.centerCol}>
        <Text style={styles.centerLabel}>{t("common_gent")}</Text>
        <Text style={styles.centerCount}>{counts?.common ?? 0}</Text>
        <Text style={styles.centerLabel}>
          {t("of")} {counts?.all ?? 0}
        </Text>
      </View>

      <ProfileColumn profile={profiles[1]} color={Colors.compareP2} />
    </View>
  );
};

export default CompareProfileHeader;

const DOT_SIZE = 12;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      // backgroundColor: Colors.primary100,
    },
    profileCol: {
      alignItems: "center",
      gap: 4,
      flex: 1,
    },
    avatarWrap: {
      position: "relative",
    },
    colorDot: {
      position: "absolute",
      bottom: -1,
      right: -1,
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      borderWidth: 2,
      borderColor: Colors.primary100,
    },
    profileName: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.textMain,
      textAlign: "center",
    },
    profileCount: {
      fontSize: 20,
      fontWeight: "600",
    },
    centerCol: {
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 8,
    },
    centerLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    centerCount: {
      fontSize: 28,
      fontWeight: "600",
      color: Colors.textMain,
    },
  });