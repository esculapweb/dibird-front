import { StyleSheet, Text, View } from 'react-native'

const ObservationDetailScreen = ({route, navigation}) => {
  const { observationId } = route.params;
  return (
    <View>
      <Text>ObservationDetailScreen {observationId}</Text>
    </View>
  )
}

export default ObservationDetailScreen

const styles = StyleSheet.create({})