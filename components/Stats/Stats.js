import { FlatList, View, Text, StyleSheet } from "react-native";

const Stats = ({ route }) => {
  const { data } = route.params;
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={styles.item}>
          <Text>
            {index + 1}. {item.sp_name}
          </Text>
        </View>
      )}
    />
  );
};

export default Stats;

const styles = StyleSheet.create({
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
});
