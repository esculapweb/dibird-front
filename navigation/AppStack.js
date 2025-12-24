import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useContext } from "react";
import WelcomeScreen from "../screens/WelcomeScreen";
import IconButton from "../components/ui/IconButton";
import { AuthContext } from "../store/auth-context";

const Stack = createNativeStackNavigator();

const AppStack = () => {
  const authCtx = useContext(AuthContext);
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "olive" },
        headerTintColor: "#fff",
        // contentStyle: { backgroundColor: Colors.primary100 },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{
          headerRight: ({ tintColor }) => (
            <IconButton
              icon="log-out-outline"
              color="#222"
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
