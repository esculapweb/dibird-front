import { useTranslation } from "react-i18next";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
  DrawerItem,
} from "@react-navigation/drawer";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import CheckEmailScreen from "../screens/CheckEmailScreen";
import ConfirmEmailScreen from "../screens/ConfirmEmailScreen";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import { useTheme } from "../store/theme-context";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import type {
  AuthDrawerParamList,
  AuthStackNavigationProp,
  AuthStackParamList,
} from "../types";
import { openSupportEmail } from "../util/openSupportEmail";
import StaticScreen from "../screens/StaticScreen";
import { catalogScreens } from "./catalogScreens";
import { track } from "../services/analytics";

const Stack = createNativeStackNavigator<AuthStackParamList>();
const Drawer = createDrawerNavigator<AuthDrawerParamList>();

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const navigation = props.navigation;
  // The catalogue screens sit in the stack above the drawer, so navigation goes
  // through the parent, the way WelcomeScreen does with its Login/Terms/Privacy.
  const stackNav = navigation.getParent<AuthStackNavigationProp>();

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <DrawerItem
          label={t("sign_in_or_sign_up")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => navigation.closeDrawer()}
          icon={({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          )}
        />
        {/* The reference is available without an account — the same two items
            as in the burger menu of a signed-in user (see AppStack). */}
        <DrawerItem
          label={t("species_catalog")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            track("guest_browse_started", { source: "drawer" });
            stackNav?.navigate("Taxonomy", {
              rank: 5,
              title: t("species_catalog"),
            });
          }}
          icon={({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          )}
        />

        <DrawerItem
          label={t("birds_by_country")}
          labelStyle={{ color: Colors.textMain }}
          onPress={() => {
            navigation.closeDrawer();
            track("guest_browse_started", { source: "drawer" });
            stackNav?.navigate("TerritoryList", undefined);
          }}
          icon={({ color, size }) => (
            <Ionicons name="globe-outline" color={color} size={size} />
          )}
        />

        <DrawerItem
          label={t("settings_send_feedback")}
          labelStyle={{ color: Colors.textMain }}
          onPress={openSupportEmail}
          icon={({ color, size }) => (
            <Ionicons name="chatbubble-outline" color={color} size={size} />
          )}
        />

        <View style={{ flex: 1 }} />
        <LanguageSwitcher />
        <ThemeSwitcher />
      </DrawerContentScrollView>
    </View>
  );
};

const WelcomeDrawer = () => {
  const { Colors } = useTheme();

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
      <Drawer.Screen name="WelcomeMain" component={WelcomeScreen} />
    </Drawer.Navigator>
  );
};

const AuthNavigator = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();

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
        name="Welcome"
        component={WelcomeDrawer}
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
        name="Login"
        component={LoginScreen}
        options={{ title: t("login") }}
      />

      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ title: t("signup") }}
      />

      <Stack.Screen
        name="CheckEmail"
        component={CheckEmailScreen}
        options={{ title: t("check_email") }}
      />

      <Stack.Screen
        name="ConfirmEmail"
        component={ConfirmEmailScreen}
        options={{ title: t("confirm_email") }}
      />

      {catalogScreens(Stack, t)}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
