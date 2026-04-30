import { useState, useLayoutEffect } from "react";
import { TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import AuthContent from "../components/Auth/AuthContent";
import { CreateUser } from "../util/auth";
import { useTheme } from "../store/theme-context";
import { AuthDrawerNavigationProp, Credentials } from "../types";

const SignupScreen = () => {
  const [loading, setLoading] = useState(false);
  const { Colors } = useTheme();
  const iconName = Platform.OS === "ios" ? "chevron-back" : "arrow-back";
  const navigation = useNavigation<AuthDrawerNavigationProp>();

  const signUpHandler = async ({ email, password, userName }: Credentials) => {
    if (loading) return;

    setLoading(true);
    try {
      if (!userName) return;
      await CreateUser(email, password, userName);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "CheckEmail",
            params: { email },
          },
        ],
      });
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

  return <AuthContent onAuthenticate={signUpHandler} loading={loading} />;
};

export default SignupScreen;
