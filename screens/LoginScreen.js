import { useContext, useState, useLayoutEffect } from "react";
import { TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
import { useTheme } from "../store/theme-context";

const LoginScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const { authenticate } = useContext(AuthContext);
  const { Colors } = useTheme();
  const iconName = Platform.OS === "ios" ? "chevron-back" : "arrow-back";

  const LoginHandler = async ({ email, password }) => {
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
    <AuthContent onAuthenticate={LoginHandler} loading={loading} isLogin />
  );
};

export default LoginScreen;
