import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { AppNotification, IconType, NotificationType } from "../../types";
import { formatDateTime } from "../../util/helpers";

const META: Record<
  NotificationType,
  { icon: IconType; color: (c: ThemeColors) => string }
> = {
  notable_obs: { icon: "binoculars-outline", color: (c) => c.main100 },
  watchlist_activity: { icon: "star-outline", color: (c) => c.accentBlue },
  system: { icon: "information-circle-outline", color: (c) => c.textSecondary },
  checklist: { icon: "information-circle-outline", color: (c) => c.textSecondary },
  achievement: { icon: "trophy-outline", color: (c) => c.accent100 },
};

interface Props {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
}

const NotificationCard = ({ item, onPress }: Props) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const meta = META[item.type];

  return (
    <TouchableOpacity
      style={[styles.card, !item.is_read && styles.unread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: meta.color(Colors) + "20" },
        ]}
      >
        <Ionicons
          name={meta.icon as IconType}
          size={20}
          color={meta.color(Colors)}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {/* "What's new" arrives as a list of bullet points, and two lines cut
            it off mid-sentence — there is nowhere else to read the rest, since
            these notifications lead to no screen. */}
        <Text
          style={styles.body}
          numberOfLines={item.type === "system" ? 8 : 2}
        >
          {item.body}
        </Text>
        <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
      </View>

      {!item.is_read && <View style={styles.dot} />}
    </TouchableOpacity>
  );
};

export default NotificationCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 6,
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    unread: {
      backgroundColor: Colors.main300,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    content: { flex: 1, gap: 2 },
    title: { fontSize: 14, fontWeight: "600", color: Colors.textMain },
    body: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
    time: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.main100,
      marginTop: 6,
      flexShrink: 0,
      alignSelf:'flex-start'
    },
  });
