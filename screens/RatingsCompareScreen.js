import { StyleSheet, Text, View } from 'react-native'

const RatingsCompareScreen = ({route}) => {
  const { profileIds } = route.params;
  return (
    <View>
      <Text>{profileIds.join(", ")}</Text>
    </View>
  )
}

export default RatingsCompareScreen

const styles = StyleSheet.create({})