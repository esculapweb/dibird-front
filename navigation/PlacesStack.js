import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PlacesScreen from "../screens/PlacesScreen";
import PlaceDetailScreen from "../screens/PlaceDetailScreen";
import { PlacesProvider } from "../store/places-context";


const PlacesStackNavigator = createNativeStackNavigator();

const PlacesStack = () => {
  return (
    <PlacesProvider>
      <PlacesStackNavigator.Navigator>
        <PlacesStackNavigator.Screen
          name="PlacesScreen"
          component={PlacesScreen}
          options={{ headerShown: false }}
        />
        <PlacesStackNavigator.Screen
          name="PlaceDetail"
          component={PlaceDetailScreen}
          options={{ title: "Place", }}
        />
      </PlacesStackNavigator.Navigator>
    </PlacesProvider>
  );
};

export default PlacesStack;