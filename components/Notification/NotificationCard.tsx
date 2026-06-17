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

      {/* Текст */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
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
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      marginBottom: 8,
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
    },
  });
