import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import { Colors } from "../constants/styles";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  const { t } = useTranslation();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary500 },
        headerTintColor: Colors.primary100,
        contentStyle: { backgroundColor: Colors.backgroundMain },
      }}
    >
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
    </Stack.Navigator>
  );
};

export default AuthStack;
