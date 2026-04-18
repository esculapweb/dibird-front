import { useTranslation } from "react-i18next";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";

import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import { useTheme } from "../store/theme-context";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";

const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <DrawerItemList {...props} />
        <View style={{ flex: 1 }} />
        <LanguageSwitcher />
        <ThemeSwitcher />
      </DrawerContentScrollView>
    </View>
  );
};

const AuthDrawer = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: Colors.textOpposite,
        drawerActiveBackgroundColor: Colors.main100,
      }}
    >
      <Drawer.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          headerTransparent: true,
          headerTitle: () => null,
          headerShadowVisible: false,
          title: t("welcome"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: t("login"),
          headerTransparent: true,
          headerShadowVisible: false,
          drawerItemStyle: { display: "none" },
        }}
      />

      <Drawer.Screen
        name={"Signup"}
        component={SignupScreen}
        options={{
          title: t("signup"),
          headerTransparent: true,
          headerShadowVisible: false,
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer.Navigator>
  );
};

export default AuthDrawer;
