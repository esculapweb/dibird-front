import { FlatList, View, Text, StyleSheet, Image } from "react-native";

import { formatDate, isoToFlagEmoji } from "../../util/fetches";
import { Config } from "../../constants/config";

const Stats = ({ data, seen = false }) => {
  const StatDates = ({ item }) => {
    const minDate = item?.min_date;
    const maxDate = item?.max_date;
    const minDateFormatted = minDate && formatDate(minDate);
    const maxDateFormatted = maxDate && formatDate(maxDate);

    if (!minDate && !maxDate) return null;

    return (
      <View>
        <Text>
          {minDateFormatted}
          {maxDateFormatted &&
            minDateFormatted !== maxDateFormatted &&
            ` – ${maxDateFormatted}`}
        </Text>
      </View>
    );
  };

  const Observations = ({item}) => {
    return <Text>Observations: {item.qty_observations}</Text>
  };

  const Countries = ({item}) => {
    const first = item?.min_territory;
    const second = item?.max_territory;

    if (!first && ! second) return null;
    return <Text>
      {isoToFlagEmoji(first)}
      {second && second!=first && isoToFlagEmoji(second)}
      {item?.qty_countries > 2 && `+ ${item.qty_countries -2}`}
    </Text>
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={styles.item}>
          <Text>
            {index + 1}. {item.sp_name_lang}
          </Text>
          <Text>{item.sp_latin}</Text>
          {seen && item.sp_thumb && (
            <Image
              source={{
                uri: `${Config.baseUrl}/media/${item.sp_thumb}`,
              }}
              style={styles.image}
            />
          )}
          {seen && <StatDates item={item} />}
          {seen && <Observations item={item} />}
          {seen && <Countries item={item} />}
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
    borderBottomColor: "#e4e4e4",
  },
  image: {
    width: 50,
    height: 50,
  },
});
