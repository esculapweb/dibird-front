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
import { useTranslation } from "react-i18next";

import WelcomeScreen from "../screens/WelcomeScreen";
import StatScreen from "../screens/StatScreen";
import Profile from "../screens/Profile";
import SettingsScreen from "../screens/SettingsScreen";

import { AuthContext } from "../store/auth-context";
import { Colors } from "../constants/styles";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";

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
  const { t } = useTranslation();

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
        <LanguageSwitcher />
        <DrawerItem
          label={t("logout")}
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
  const { t } = useTranslation();
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
      <Drawer.Screen name={t("statistics")} component={StatScreen} />
      {/* <Drawer.Screen name={t('settings')} component={SettingsScreen} /> */}
      <Drawer.Screen
        name="Profile"
        component={AppStack}
        options={{ title: t("profile") }}
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
