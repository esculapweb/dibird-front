import {
  FlatList,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../store/theme-context";
import { isoToFlagEmoji } from "../../util/fetches";

const BirdSVG = ({ size = 16, color }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
    <Path d="M172,68a8,8,0,1,1-8-8A7.99993,7.99993,0,0,1,172,68Zm-55.07324,65.43945-40,48a4.00015,4.00015,0,0,0,6.14648,5.1211l40-48a4.00015,4.00015,0,1,0-6.14648-5.1211ZM236,80a3.9985,3.9985,0,0,1-1.78125,3.32812L212,98.14062V120A100.113,100.113,0,0,1,112,220H8a3.99977,3.99977,0,0,1-3.123-6.499L100,94.59668V76A56.00814,56.00814,0,0,1,209.794,60.3877l24.4248,16.28418A3.99914,3.99914,0,0,1,236,80Zm-11.21094,0-20.6748-13.78418a3.99981,3.99981,0,0,1-1.65235-2.32227A48.00774,48.00774,0,0,0,108,76V96a4.00184,4.00184,0,0,1-.87695,2.499L16.32227,212H112a92.10447,92.10447,0,0,0,92-92V96a3.9985,3.9985,0,0,1,1.78125-3.32812Z" />
  </Svg>
);

const StatIconWrapper = ({ children }) => (
  <View
    style={{
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {children}
  </View>
);

const Places = ({ data, onEndReached, isLoadingMore, onAddPlace }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const renderPlace = ({ item }) => {
    const territoryText = item.territory_data
      ? isoToFlagEmoji(item.territory_data.code)
      : null;

    const [lng, lat] = item.location.coordinates;

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      >
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexShrink: 1,
              }}
            >
              {item.favourite && (
                <Ionicons
                  name="star"
                  size={18}
                  color={Colors.accent}
                  style={styles.star}
                />
              )}
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {item.name}
              </Text>
            </View>

            {territoryText && <Text style={styles.flag}>{territoryText}</Text>}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.coordRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.subLine}>
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
            </View>

            <View style={styles.statsBlock}>
              <View style={styles.statItem}>
                <StatIconWrapper>
                  <Ionicons
                    name="book-outline"
                    size={16}
                    color={Colors.textMain}
                  />
                </StatIconWrapper>
                <Text style={styles.statValue}>{item.diary_count}</Text>
              </View>
              <View style={styles.statItem}>
                <StatIconWrapper>
                  <Ionicons
                    name="eye-outline"
                    size={16}
                    color={Colors.textMain}
                  />
                </StatIconWrapper>
                <Text style={styles.statValue}>{item.observation_count}</Text>
              </View>
              <View style={styles.statItem}>
                <StatIconWrapper>
                  <BirdSVG size={16} color={Colors.textMain} />
                </StatIconWrapper>
                <Text style={styles.statValue}>{item.species_count}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPlace}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore && (
            <ActivityIndicator
              size="small"
              color={Colors.textMain}
              style={{ marginVertical: 10 }}
            />
          )
        }
      />

      <Pressable style={styles.fab} onPress={onAddPlace}>
        <Ionicons name="add" size={28} color={Colors.buttonPrimaryText} />
      </Pressable>
    </>
  );
};

export default Places;

const stylesFn = (Colors) =>
  StyleSheet.create({
    list: { padding: 12 },

    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    pressedCard: { opacity: 0.85 },

    main: {
      marginBottom: 0,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },

    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 1,
    },

    star: {
      marginRight: 6,
    },

    flag: {
      marginLeft: 6,
    },

    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },

    coordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 1,
    },

    subLine: {
      fontSize: 12,
      color: Colors.textSecondary,
    },

    statsBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    statItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.badgeBg,
      borderRadius: 6,
      paddingHorizontal: 4,
    },

    statValue: {
      fontSize: 12,
      color: Colors.textMain,
      marginLeft: 2,
    },

    fab: {
      position: "absolute",
      bottom: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.buttonBg,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
