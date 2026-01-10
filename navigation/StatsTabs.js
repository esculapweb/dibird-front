import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import SeenScreen from "../components/Stats/SeenScreen";
import NotSeenScreen from "../components/Stats/NotSeenScreen";
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
      >
        {() => <SeenScreen route={{ params: { seen } }} />}
      </Tab.Screen>
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
      >
        {() => <NotSeenScreen route={{ params: { notSeen } }} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default StatsTabs;
