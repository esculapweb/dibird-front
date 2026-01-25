import { useTranslation } from "react-i18next";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";

import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
        drawerActiveTintColor: Colors.primary500,
        drawerActiveBackgroundColor: Colors.primary200,
      }}
    >
      <Drawer.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: t("login"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "log-in" : "log-in-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />

      <Drawer.Screen
        name={"Signup"}
        component={SignupScreen}
        options={{
          title: t("signup"),
          drawerIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person-add" : "person-add-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

export default AuthDrawer;
