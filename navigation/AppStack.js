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
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ErrorScreen from "../screens/ErrorScreen";

import { AuthContext } from "../store/auth-context";
import { useProfile } from "../store/profile-context";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useTheme } from "../store/theme-context";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AppStack = () => {
  const { Colors } = useTheme();
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
        options={{
          headerShown: false,
        }}
      >
        {() => <ProfileScreen />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const CustomDrawerContent = (props) => {
  const authCtx = useContext(AuthContext);
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const handleLogout = async () => {
    props.navigation.closeDrawer?.();
    await authCtx.logout();
  };

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
        <ThemeSwitcher />
        <DrawerItem
          label={t("logout")}
          labelStyle={{ color: Colors.primary500 }}
          onPress={handleLogout}
          style={styles.logout}
          icon={({ color, size }) => (
            <Ionicons name="log-out-outline" color={color} size={size} />
          )}
        />
      </DrawerContentScrollView>
    </View>
  );
};

const AppDrawer = () => {
  const { t } = useTranslation();
  const profileCtx = useProfile();
  const { Colors } = useTheme();

  if (profileCtx.error) {
    console.warn(
      "profileCtx error",
      profileCtx.error.code,
      profileCtx.error.message,
    );
    return <ErrorScreen />;
  }

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: Colors.primary100,
        },
        drawerActiveTintColor: Colors.primary500,
        drawerActiveBackgroundColor: Colors.primary200,
        headerStyle: {
          backgroundColor: Colors.primary500,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: Colors.primary100,
        sceneContainerStyle: { backgroundColor: Colors.backgroundMain },
      }}
    >
      {/* <Drawer.Screen
        name={t("settings")}
        component={SettingsScreen}
        options={{
          title: t("settings"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      /> */}
      <Drawer.Screen
        name={"Statistics"}
        component={StatScreen}
        options={{
          title: t("statistics"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "stats-chart" : "stats-chart-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={AppStack}
        options={{
          title: t("profile"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

export default AppDrawer;

const stylesFn = (Colors) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      alignItems: "center",
      marginBottom: 24,
    },
    logout: {
      borderTopWidth: 1,
      borderColor: Colors.backgroundMain,
    },
  });
