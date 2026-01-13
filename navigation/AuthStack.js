import { useTranslation } from "react-i18next";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";

import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import { Colors } from "../constants/styles";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";

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
      </DrawerContentScrollView>
    </View>
  );
};

const AuthDrawer = () => {
  const { t } = useTranslation();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: Colors.primary100,
        },
        drawerActiveTintColor: Colors.primary500,
        headerStyle: {
          backgroundColor: Colors.primary500,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: Colors.primary100,
        sceneContainerStyle: { backgroundColor: Colors.backgroundMain },
      }}
    >
      <Drawer.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: t("login") }}
      />

      <Drawer.Screen
        name={"Signup"}
        component={SignupScreen}
        options={{ title: t("signup") }}
      />
    </Drawer.Navigator>
  );
};

export default AuthDrawer;
