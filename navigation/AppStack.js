import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
} from "@react-navigation/drawer";
import { useContext } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import WelcomeScreen from "../screens/WelcomeScreen";
import StatScreen from "../screens/StatScreen";
import Profile from "../screens/Profile";
import { AuthContext } from "../store/auth-context";
import { Colors } from "../constants/styles";
import Avatar from "../components/Profile/Avatar";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AppStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary500,
          elevation: 0,
        },
        headerTintColor: Colors.primary100,
        contentStyle: { backgroundColor: Colors.backgroundMain }, 
      }}
    >
      <Stack.Screen
        name="ProfileScreen"
        component={Profile}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

function CustomDrawerContent(props) {
  const authCtx = useContext(AuthContext);

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.header}>
          <Avatar />
        </View>
        <DrawerItemList {...props} />
        <View style={{ flex: 1 }} />
        <DrawerItem
          label="Logout"
          labelStyle={{ color: Colors.primary500 }}
          onPress={authCtx.logout}
          icon={({ color, size }) => (
            <Ionicons name="log-out-outline" color={color} size={size} />
          )}
        />
      </DrawerContentScrollView>
    </View>
  );
}

const AppDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: Colors.primary100,
        },
        drawerActiveTintColor: Colors.primary500,
        headerStyle: {
          backgroundColor: Colors.primary500, 
          elevation: 0, 
          shadowOpacity: 0, 
        },
        headerTintColor: Colors.primary100, 
        sceneContainerStyle: { backgroundColor: Colors.backgroundMain }
      }}
    >
       <Drawer.Screen name="Statistics" component={StatScreen} />
      <Drawer.Screen name="Welcome" component={WelcomeScreen} />
      <Drawer.Screen
        name="Profile"
        component={AppStack}
        options={{ title: "Profile" }}
      />
    </Drawer.Navigator>
  );
};

export default AppDrawer;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 24,
  },
});
