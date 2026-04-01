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
import { useQueryClient } from "@tanstack/react-query";

import ErrorScreen from "../screens/ErrorScreen";
import MainScreen from "../screens/MainScreen";
import StatScreen from "../screens/StatScreen";
import PlacesScreen from "../screens/PlacesScreen";
import PlaceDetailScreen from "../screens/PlaceDetailScreen";
import PlaceEditorScreen from "../screens/PlaceEditorScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ObservationsScreen from "../screens/ObservationsScreen";
import ObservationDetailScreen from "../screens/ObservationDetailScreen";
import ObservationEditorScreen from "../screens/ObservationEditorScreen";
import DiariesScreen from "../screens/DiariesScreen";
import DiaryDetailScreen from "../screens/DiaryDetailScreen";
import DiaryEditorScreen from "../screens/DiaryEditorScreen";
import RatingScreen from "../screens/RatingScreen";
import RatingsCompareScreen from "../screens/RatingsCompareScreen";
import UserStatScreen from "../screens/UserStatScreen";
import SettingsScreen from "../screens/SettingsScreen";

import { AuthContext } from "../store/auth-context";
import { useProfile } from "../store/profile-context";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useTheme } from "../store/theme-context";
import { useFilters } from "../store/filters-context";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
  const { logout } = useContext(AuthContext);
  const { resetProfile } = useProfile();
  const { resetFilters } = useFilters();
  const queryClient = useQueryClient();
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
            resetProfile();
            await resetFilters();
            queryClient.clear();
            await logout();
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
const MainDrawer = () => {
  const { t } = useTranslation();
  const { error } = useProfile();
  const { Colors } = useTheme();

  if (error) return <ErrorScreen />;

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: Colors.primary500,
        drawerActiveBackgroundColor: Colors.primary200,
      }}
    >
      <Drawer.Screen
        name="MainDrawer"
        component={MainScreen}
        options={{
          title: t("main"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
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

      <Drawer.Screen
        name="Settings"
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
      />
    </Drawer.Navigator>
  );
};

const AppNavigator = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={MainDrawer}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Stat"
        component={StatScreen}
        options={({ route }) => ({
          title: t("statistics"),
          headerBackTitleVisible: false,
          headerBackTitle: route.params?.backTitle ?? t("main"),
        })}
      />

      <Stack.Screen
        name="Checklist"
        component={StatScreen}
        options={{
          title: t("checklist"),
          headerBackTitleVisible: false,
          headerBackTitle: t("main"),
        }}
      />

      <Stack.Screen
        name="Places"
        component={PlacesScreen}
        options={{
          title: t("places"),
          headerBackTitleVisible: false,
          headerBackTitle: t("main"),
        }}
      />

      <Stack.Screen
        name="PlaceDetail"
        component={PlaceDetailScreen}
        options={{
          title: t(""),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="PlaceEditor"
        component={PlaceEditorScreen}
        options={{
          title: t("new_place"),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="Observations"
        component={ObservationsScreen}
        options={{
          title: t("observations"),
          headerBackTitleVisible: false,
          headerBackTitle: t("main"),
        }}
      />

      <Stack.Screen
        name="ObservationDetail"
        component={ObservationDetailScreen}
        options={{
          title: t(""),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="ObservationEditor"
        component={ObservationEditorScreen}
        options={{
          title: t("new_observation"),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="Diaries"
        component={DiariesScreen}
        options={{
          title: t("diaries"),
          headerBackTitleVisible: false,
          headerBackTitle: t("main"),
        }}
      />

      <Stack.Screen
        name="DiaryDetail"
        component={DiaryDetailScreen}
        options={{
          title: t(""),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="DiaryEditor"
        component={DiaryEditorScreen}
        options={{
          title: t("new_diary"),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{
          title: t("rating"),
          headerBackTitleVisible: false,
          headerBackTitle: t("main"),
        }}
      />

      <Stack.Screen
        name="RatingsCompare"
        component={RatingsCompareScreen}
        options={{
          title: t("rating_compare"),
          headerBackTitleVisible: false,
        }}
      />

      <Stack.Screen
        name="UserStat"
        component={UserStatScreen}
        options={{
          title: t("user_statistics"),
          headerBackTitleVisible: false,
        }}
      />

    </Stack.Navigator>
  );
};

export default AppNavigator;

const stylesFn = (Colors) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, alignItems: "center", marginBottom: 24 },
    logout: { borderTopWidth: 1, borderColor: Colors.divider },
  });
