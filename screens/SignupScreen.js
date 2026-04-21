import { useState, useLayoutEffect } from "react";
import { TouchableOpacity, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import AuthContent from "../components/Auth/AuthContent";
import { CreateUser } from "../util/auth";
import { useTheme } from "../store/theme-context";

const SignupScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const iconName = Platform.OS === "ios" ? "chevron-back" : "arrow-back";

  const signUpHandler = async ({ email, password, userName }) => {
    if (loading) return;

    setLoading(true);
    try {
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
