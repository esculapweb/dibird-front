import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { useEffect } from "react";
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
// import SettingsScreen from "../screens/SettingsScreen";

import { useAuth, setOnLogout } from "../store/auth-context";
import { useProfile } from "../store/profile-context";
import Avatar from "../components/Profile/Avatar";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useTheme } from "../store/theme-context";
import { useFilters } from "../store/filters-context";
import { LightColors } from "../constants/colors/light";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { logout } = useAuth();
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
            await logout();
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
        drawerActiveTintColor: Colors.textOpposite,
        drawerActiveBackgroundColor: Colors.main100,
        headerShown: false,
        headerBackButtonDisplayMode: "minimal",
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
          headerTransparent: true,
          headerShadowVisible: false,
          headerShown: true,
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />

      {/* <Drawer.Screen
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
      /> */}
    </Drawer.Navigator>
  );
};

const AppNavigator = () => {
  const { t } = useTranslation();
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
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainDrawer}
        options={{ headerShown: false }}
      />

      <Stack.Screen name="Stat" component={StatScreen} />

      <Stack.Screen name="Checklist" component={StatScreen} />

      <Stack.Screen name="Places" component={PlacesScreen} />

      <Stack.Screen
        name="PlaceDetail"
        component={PlaceDetailScreen}
        options={{
          title: t("place"),
        }}
      />

      <Stack.Screen
        name="PlaceEditor"
        component={PlaceEditorScreen}
        options={{
          title: t("new_place"),
        }}
      />

      <Stack.Screen name="Observations" component={ObservationsScreen} />

      <Stack.Screen
        name="ObservationDetail"
        component={ObservationDetailScreen}
        options={{
          title: t("observation"),
        }}
      />

      <Stack.Screen
        name="ObservationEditor"
        component={ObservationEditorScreen}
        options={{
          title: t("new_observation"),
        }}
      />

      <Stack.Screen name="Diaries" component={DiariesScreen} />

      <Stack.Screen
        name="DiaryDetail"
        component={DiaryDetailScreen}
        options={{
          title: t("diary"),
        }}
      />

      <Stack.Screen
        name="DiaryEditor"
        component={DiaryEditorScreen}
        options={{
          title: t("new_diary"),
        }}
      />

      <Stack.Screen name="Rating" component={RatingScreen} />

      <Stack.Screen
        name="RatingsCompare"
        component={RatingsCompareScreen}
        options={{
          title: t("rating_compare"),
        }}
      />

      <Stack.Screen name="UserStat" component={UserStatScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;

const stylesFn = (Colors: typeof LightColors) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, alignItems: "center", marginBottom: 24 },
    logout: { borderTopWidth: 1, borderColor: Colors.divider },
  });
