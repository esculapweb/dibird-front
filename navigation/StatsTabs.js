import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Stats from "../components/Stats/Stats";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/styles";

const Tab = createBottomTabNavigator();

const StatsTabs = ({ seen, notSeen }) => {
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
          title: `Seen (${seen.length})`,
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
          title: `Not seen (${notSeen.length})`,
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
