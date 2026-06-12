import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, StyleSheet } from "react-native";
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
  DrawerItem,
} from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { useEffect } from "react";
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
import AlertSettingsScreen from "../screens/AlertSettingsScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import SpeciesDetailScreen from "../screens/SpeciesDetailScreen";
import AchievementsScreen from "../screens/AchievementsScreen";
import WatchlistEditorScreen from "../screens/WatchlistEditorScreen";

import { useAuth, setOnLogout } from "../store/auth-context";
import { useProfile } from "../store/profile-context";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useFilters } from "../store/filters-context";
import { BottomSheet } from "../services/bottomSheet";
import type { AppDrawerParamList, AppStackParamList } from "../types";
import StaticScreen from "../screens/StaticScreen";

const Stack = createNativeStackNavigator<AppStackParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();

// ---------------------------------------------------------------------------
// Custom drawer content
// ---------------------------------------------------------------------------
const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { logout } = useAuth();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = props.navigation;

  const handleLogout = () => {
    BottomSheet.show({
      title: t("logout_title"),
      description: t("logout_message"),
      confirmText: t("logout"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: async () => {
        await logout();
      },
    });
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

        {/* Главный экран */}
        <DrawerItem
          label={t("main")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate("MainScreen");
          }}
          icon={({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          )}
        />

        {/* Профиль — переход через Stack */}
        <DrawerItem
          label={t("profile")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate("Profile");
          }}
          icon={({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          )}
        />

        {/* Настройки — переход через Stack */}
        <DrawerItem
          label={t("settings")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate("Settings");
          }}
          icon={({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          )}
        />

        <View style={{ flex: 1 }} />
        <LanguageSwitcher />
        <ThemeSwitcher />

        <DrawerItem
          label={t("logout")}
          labelStyle={{ color: Colors.textMain }}
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

// ---------------------------------------------------------------------------
// MainDrawer
// ---------------------------------------------------------------------------
const MainDrawer = () => {
  const { error } = useProfile();
  const { Colors } = useTheme();

  if (error) return <ErrorScreen />;

  return (
    <Drawer.Navigator
      id={undefined}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: Colors.textOpposite,
        drawerActiveBackgroundColor: Colors.main100,
        headerShown: false,
      }}
    >
      <Drawer.Screen name="MainScreen" component={MainScreen} />
    </Drawer.Navigator>
  );
};

// ---------------------------------------------------------------------------
// AppNavigator
// ---------------------------------------------------------------------------
const AppNavigator = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { resetFilters } = useFilters();
  const queryClient = useQueryClient();

  useEffect(() => {
    setOnLogout(async () => {
      await resetFilters();
      queryClient.clear();
    });

    return () => setOnLogout(null);
  }, [resetFilters, queryClient]);

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
        headerStyle: {
          backgroundColor: Colors.backgroundMain,
        },
        headerTintColor: Colors.textMain,
        headerTitleStyle: {
          color: Colors.textMain,
        },
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainDrawer}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Privacy"
        component={StaticScreen}
        options={{ title: t("privacy_policy") }}
      />
      <Stack.Screen
        name="Terms"
        component={StaticScreen}
        options={{ title: t("terms_of_service") }}
      />

      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("profile") }}
      />

      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t("settings") }}
      />

      <Stack.Screen
        name="AlertSettings"
        component={AlertSettingsScreen}
        options={{ title: t("alert_settings") }}
      />

      <Stack.Screen
        name="WatchlistEditor"
        component={WatchlistEditorScreen}
        options={{ title: t("alert_settings") }}
      />

      <Stack.Screen
        name="Stat"
        component={StatScreen}
        options={{ title: t("stat") }}
      />

      <Stack.Screen
        name="Checklist"
        component={StatScreen}
        options={{ title: t("checklist") }}
      />

      <Stack.Screen
        name="Places"
        component={PlacesScreen}
        options={{ title: t("places") }}
      />

      <Stack.Screen
        name="PlaceDetail"
        component={PlaceDetailScreen}
        options={{ title: t("place") }}
      />

      <Stack.Screen
        name="PlaceEditor"
        component={PlaceEditorScreen}
        options={{ title: t("new_place") }}
      />

      <Stack.Screen
        name="Observations"
        component={ObservationsScreen}
        options={{ title: t("observations") }}
      />

      <Stack.Screen
        name="ObservationDetail"
        component={ObservationDetailScreen}
        options={{ title: t("observation") }}
      />

      <Stack.Screen
        name="ObservationEditor"
        component={ObservationEditorScreen}
        options={{ title: t("new_observation") }}
      />

      <Stack.Screen
        name="Diaries"
        component={DiariesScreen}
        options={{ title: t("diaries") }}
      />

      <Stack.Screen
        name="DiaryDetail"
        component={DiaryDetailScreen}
        options={{ title: t("diary") }}
      />

      <Stack.Screen
        name="DiaryEditor"
        component={DiaryEditorScreen}
        options={{ title: t("new_diary") }}
      />

      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{ title: t("rating") }}
      />

      <Stack.Screen
        name="RatingsCompare"
        component={RatingsCompareScreen}
        options={{ title: t("rating_compare") }}
      />

      <Stack.Screen
        name="UserStat"
        component={UserStatScreen}
        options={{ title: t("user_stat") }}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t("notifications") }}
      />

      <Stack.Screen
        name="SpeciesDetail"
        component={SpeciesDetailScreen}
        options={{ title: t("species") }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{ title: t("achievements") }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, alignItems: "center", marginBottom: 24 },
    logout: { borderTopWidth: 1, borderColor: Colors.divider },
  });
