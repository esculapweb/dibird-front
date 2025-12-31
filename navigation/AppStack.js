import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import WelcomeScreen from "../screens/WelcomeScreen";
import IconButton from "../components/ui/IconButton";
import { AuthContext } from "../store/auth-context";
import { Colors } from "../constants/styles";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator();

const AppStack = () => {
  const authCtx = useContext(AuthContext);
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary500,
          elevation: 0,
        },
        headerShadowVisible: false,
        headerTintColor: Platform.select({
          ios: Colors.primary500,
          android: Colors.primary100,
        }),
        headerTitleStyle: {
          fontWeight: "600",
        },
        // contentStyle: { backgroundColor: Colors.primary100 },
      }}
    >
      <Stack.Screen
        name="Profile"
        component={WelcomeScreen}
        options={{
          headerRight: ({ tintColor }) => (
            <IconButton
              icon="log-out-outline"
              color={tintColor}
              size={24}
              onPress={authCtx.logout}
              style={{ marginTop: -2 }}
            />
          ),
        }}
      />
    </Stack.Navigator>
  );
};

export default AppStack;
