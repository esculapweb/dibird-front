import { useState, useLayoutEffect } from "react";
import { TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useAuth } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
import { useTheme } from "../store/theme-context";
import {
  AuthDrawerNavigationProp,
  AuthDrawerRouteProp,
} from "../types";

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const { authenticate } = useAuth();
  const { Colors } = useTheme();
  const navigation = useNavigation<AuthDrawerNavigationProp>();
  const route = useRoute<AuthDrawerRouteProp<"Login">>();

  const iconName = Platform.OS === "ios" ? "chevron-back" : "arrow-back";

  const emailConfirmed = route.params?.emailConfirmed;
  const prefillEmail = route.params?.prefillEmail;

  const LoginHandler = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    if (loading) return;

    setLoading(true);
    try {
      const token = await Login(email, password);
      await authenticate(token);
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("Welcome")}
          style={{ padding: 8 }}
          hitSlop={16}
        >
          <Ionicons name={iconName} size={24} color={Colors.textMain} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, Colors, iconName]);

  return (
    <AuthContent
      onAuthenticate={LoginHandler}
      loading={loading}
      emailConfirmed={emailConfirmed}
      prefillEmail={prefillEmail}
      isLogin
    />
  );
};

export default LoginScreen;
