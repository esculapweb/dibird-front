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
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import EmailsScreen from "../screens/EmailsScreen";
import LinkedAccountsScreen from "../screens/LinkedAccountsScreen";
import ConfirmEmailScreen from "../screens/ConfirmEmailScreen";
import AlertSettingsScreen from "../screens/AlertSettingsScreen";
import ImportScreen from "../screens/ImportScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import AchievementsScreen from "../screens/AchievementsScreen";
import CommunityScreen from "../screens/CommunityScreen";
import CommunityDetailScreen from "../screens/CommunityDetailScreen";
import OnboardingScreen from "../screens/OnboardingScreen";

import { useAuth, setOnLogout } from "../store/auth-context";
import { useProfile } from "../store/profile-context";
import { useOnboarding } from "../store/onboarding-context";
import { clearAllListCaches } from "../hooks/repositories/listCacheRepository";
import { clearReferenceData } from "../hooks/repositories/referenceRepository";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useFilters } from "../store/filters-context";
import { useLanguage } from "../store/language-context";
import { useDropdownQuery } from "../hooks/useDropdownQuery";
import { fetchSpecies } from "../util/fetches";
import { BottomSheet } from "../services/bottomSheet";
import type { AppDrawerParamList, AppStackParamList } from "../types";
import StaticScreen from "../screens/StaticScreen";
import { catalogScreens } from "./catalogScreens";

const Stack = createNativeStackNavigator<AppStackParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();

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

        {/* Species catalogue — a reference, not "my data" */}
        <DrawerItem
          label={t("species_catalog")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate("Taxonomy", {
              rank: 5,
              title: t("species_catalog"),
            });
          }}
          icon={({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          )}
        />

        {/* Birds by country — the second half of the reference, next to the catalogue */}
        <DrawerItem
          label={t("birds_by_country")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate("TerritoryList", undefined);
          }}
          icon={({ color, size }) => (
            <Ionicons name="globe-outline" color={color} size={size} />
          )}
        />

        {/* Profile — navigated through the Stack */}
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

        {/* Community — navigated through the Stack */}
        <DrawerItem
          label={t("community")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate("Community");
          }}
          icon={({ color, size }) => (
            <Ionicons name="people-circle-outline" color={color} size={size} />
          )}
        />

        

        {/* Settings — navigated through the Stack */}
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

const AppNavigator = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { resetFilters, territory, date } = useFilters();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { status: onboardingStatus } = useOnboarding();

  useEffect(() => {
    setOnLogout(async () => {
      await resetFilters();
      queryClient.clear();
      clearAllListCaches();
      clearReferenceData();
    });

    return () => setOnLogout(null);
  }, [resetFilters, queryClient]);

  // Warms the species dropdown cache here (root of the authenticated stack)
  // rather than from any single screen, so it's available on
  // ObservationEditorScreen regardless of which screen the session actually
  // started on (deep link straight to Observations never mounts Main/
  // BirdOfTheDay). Key shape must match ObservationForm/FilterSheetContent's
  // useDropdownQuery call exactly for the cache entry to be shared.
  useDropdownQuery({
    type: "SpeciesDropdown",
    queryFn: (sort) => fetchSpecies(territory, sort, date),
    params: [territory, language, date],
    enabled: !!territory,
  });

  // The initial route of the stack depends on whether onboarding has been done,
  // and NavigationContainer reads it once: there is no way to render the
  // navigator with `Main` as the root and add onboarding on a second render. The
  // same trick as in Navigation.tsx, which renders null until initialState is
  // ready.
  if (onboardingStatus === "loading") return null;

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
      {/* Declared first — meaning it is the root of the stack until it is
          passed. `complete()`/`skip()` remove the screen from the navigator, and
          the stack falls back to `Main`: the same conditional render with which
          Navigation switches AuthStack/AppStack. The "back" gesture is off — it
          can only be left via "Skip", otherwise on iOS a swipe would open the
          dashboard from under an unfinished flow. */}
      {onboardingStatus === "needed" && (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      )}

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
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ title: t("blocked_users") }}
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
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: t("change_password") }}
      />

      <Stack.Screen
        name="Emails"
        component={EmailsScreen}
        options={{ title: t("emails_title") }}
      />

      <Stack.Screen
        name="LinkedAccounts"
        component={LinkedAccountsScreen}
        options={{ title: t("linked_accounts_title") }}
      />

      {/* Also in AuthStack. The letter that confirms a second address arrives
          while the person is already signed in, and without the route here
          that deep link would resolve to nothing. */}
      <Stack.Screen
        name="ConfirmEmail"
        component={ConfirmEmailScreen}
        options={{ title: t("confirm_email") }}
      />

      <Stack.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: t("import_data") }}
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
        name="Community"
        component={CommunityScreen}
        options={{ title: t("community") }}
      />

      <Stack.Screen
        name="CommunityDetail"
        component={CommunityDetailScreen}
        options={{ title: t("observation") }}
      />

      {catalogScreens(Stack, t)}

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
