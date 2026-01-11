import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Stats from "../components/Stats/Stats";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Colors } from "../constants/styles";

const Tab = createBottomTabNavigator();

const StatsTabs = ({ seen, notSeen }) => {
  const { t } = useTranslation();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary500,
      }}
    >
      <Tab.Screen
        name="Seen"
        options={{
          title: `${t("seen")} (${seen.length})`,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "eye" : "eye-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      >{() => <Stats data={seen} />}</Tab.Screen>
      <Tab.Screen
        name="NotSeen"
        options={{
          title: `${t("not_seen")} (${notSeen.length})`,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? "eye-off" : "eye-off-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      >{() => <Stats data={notSeen} />}</Tab.Screen>
    </Tab.Navigator>
  );
};

export default StatsTabs;
