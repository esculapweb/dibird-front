import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable } from "react-native";
import Stats from "../components/Stats/Stats";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

const Tab = createBottomTabNavigator();

const StatsTabs = ({ seen, notSeen, territory, emptyType, onAdd, onClear }) => {
  const { t } = useTranslation();

  const seenTitle = `${t("seen")} (${seen.length})`;
  const notSeenTitle = `${t("not_seen")} (${notSeen.length})`;

  const getNotSeenToast = () => {
    if (!territory) {
      return {
        text1: t("no_data"),
        text2: t("select_country_hint"),
      };
    }

    return {
      text1: t("no_data"),
      text2: t("no_not_seen_empty"),
    };
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Seen"
        options={{
          title: seenTitle,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "eye" : "eye-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      >
        {() => (
          <Stats
            data={seen}
            seen={true}
            onAdd={onAdd}
            emptyType={emptyType}
            onClear={onClear}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="NotSeen"
        options={{
          title: notSeenTitle,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "eye-off" : "eye-off-outline"}
              size={size}
              color={color}
            />
          ),
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPress={() => {
                if (notSeen.length === 0) {
                  Toast.show({
                    type: "info",
                    ...getNotSeenToast(),
                  });
                } else {
                  props.onPress?.();
                }
              }}
              style={[props.style, notSeen.length === 0 && { opacity: 0.4 }]}
            />
          ),
        }}
      >
        {() => <Stats data={notSeen} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default StatsTabs;
