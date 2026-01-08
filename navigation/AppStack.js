import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem  } from "@react-navigation/drawer";
import { useContext } from "react";
import { Ionicons } from '@expo/vector-icons';

import WelcomeScreen from "../screens/WelcomeScreen";
import Profile from "../screens/Profile";
import { AuthContext } from "../store/auth-context";
import { Colors } from "../constants/styles";
import { View, Text} from "react-native";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AppStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary500,
          elevation: 0,
        },
        headerTintColor: Colors.primary100,
      }}
    >
      <Stack.Screen
        name="ProfileScreen"
        component={Profile}
        options={{
          headerShown: false
        }}
      />  
    </Stack.Navigator>
  );
};


function CustomDrawerContent(props) {
  const authCtx = useContext(AuthContext);

  return (
    <View style={{ flex: 1 }}>
      {/* <View >
        <Text >Denis</Text>
      </View> */}

      <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1 }}>
        <DrawerItemList {...props} />
        <View style={{ flex: 1 }} />
        <DrawerItem
          label="Logout"
          labelStyle={{ color: Colors.primary500 }}
          onPress={authCtx.logout}
          icon={({color, size}) => (
            <Ionicons name="log-out-outline" color={color} size={size} />
          )}
        />
      </DrawerContentScrollView>
    </View>
  );
}


const AppDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: Colors.primary100,
        },
        drawerActiveTintColor: Colors.primary500,
      }}
    >
      <Drawer.Screen name="Welcome" component={WelcomeScreen} />
      <Drawer.Screen
        name="Profile"
        component={AppStack}
        options={{ title: "Profile" }}
      />
    </Drawer.Navigator>
  );
};

export default AppDrawer;
