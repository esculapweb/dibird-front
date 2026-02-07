import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
} from "@react-navigation/drawer";
import { useContext } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import WelcomeScreen from "../screens/WelcomeScreen";
import StatScreen from "../screens/StatScreen";
import PlacesScreen from "../screens/PlacesScreen";
import PlaceDetailScreen from "../screens/PlaceDetailScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ErrorScreen from "../screens/ErrorScreen";
import AddPlaceScreen from "../screens/AddPlaceScreen";

import { AuthContext } from "../store/auth-context";
import { useProfile } from "../store/profile-context";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useTheme } from "../store/theme-context";

const RootStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// --- Custom Drawer ---
const CustomDrawerContent = (props) => {
  const authCtx = useContext(AuthContext);
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const handleLogout = () => {
    Alert.alert(
      t("logout_title"),
      t("logout_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("logout"),
          style: "destructive",
          onPress: async () => {
            await authCtx.logout();
            props.navigation.closeDrawer?.();
          },
        },
      ],
      { cancelable: true },
    );
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

// --- Drawer navigator ---
const AppDrawer = () => {
  const { t } = useTranslation();
  const profileCtx = useProfile();
  const { Colors } = useTheme();

  if (profileCtx.error) return <ErrorScreen />;

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: Colors.primary500,
        drawerActiveBackgroundColor: Colors.primary200,
      }}
    >
      <Drawer.Screen
        name="Statistics"
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
        name="Places"
        component={PlacesScreen}
        options={{
          title: t("places"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "location" : "location-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
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

// --- Root navigator ---
const RootNavigator = () => {
  const { t } = useTranslation();

  return (
    <RootStack.Navigator>
      {/* <RootStack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      /> */}

      <RootStack.Screen
        name="Main"
        component={AppDrawer}
        options={{ headerShown: false }}
      />

      <RootStack.Screen
        name="PlaceDetail"
        component={PlaceDetailScreen}
        options={{
          title: t("place"),
          headerBackTitleVisible: false,
          headerBackTitle: t("places"),
        }}
      />

      <RootStack.Screen
        name="AddPlace"
        component={AddPlaceScreen}
        options={{ headerShown: true }}
      />
    </RootStack.Navigator>
  );
};

export default RootNavigator;

const stylesFn = (Colors) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, alignItems: "center", marginBottom: 24 },
    logout: { borderTopWidth: 1, borderColor: Colors.divider },
  });
