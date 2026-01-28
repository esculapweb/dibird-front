import { useCallback } from "react";
import { FlatList } from "react-native";

import StatCard from "./StatCard";

const Stats = ({ data, seen = false }) => {
  const renderItem = useCallback(
    ({ item, index }) => <StatCard item={item} index={index} seen={seen} />,
    [],
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={{padding: 12}}
    />
  );
};

export default Stats;
