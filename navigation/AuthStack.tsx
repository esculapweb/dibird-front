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
import type { AuthDrawerParamList, AuthStackParamList } from "../types";
import { openSupportEmail } from "../util/openSupportEmail";

const Stack = createNativeStackNavigator<AuthStackParamList>();
const Drawer = createDrawerNavigator<AuthDrawerParamList>();

// ---------------------------------------------------------------------------
// Custom drawer content — только Welcome в меню, остальные недоступны
// ---------------------------------------------------------------------------
const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const navigation = props.navigation;

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

// ---------------------------------------------------------------------------
// WelcomeDrawer — только Welcome, drawer только для смены языка/темы
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// AuthDrawer — все экраны в Stack с единым хедером
// ---------------------------------------------------------------------------
const AuthNavigator = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeDrawer}
        options={{ headerShown: false }}
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
    </Stack.Navigator>
  );
};

export default AuthNavigator;
