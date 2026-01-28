import { useCallback } from "react";
import { FlatList } from "react-native";
import { useTranslation } from "react-i18next";

import StatCard from "./StatCard";
import EmptyState from "../Empty/EmptyState";

const Stats = ({ data, seen = false, emptyType, onAdd, onClear }) => {
  const { t } = useTranslation();

  const getEmptyProps = () => {
    if (!emptyType) return null;

    if (emptyType === "filtered") {
      return {
        icon: "search-outline",
        message: t("nothing_found"),
        actions: [{ label: t("reset_filters"), onPress: onClear }],
      };
    }

    return {
      icon: "stats-chart",
      message: t("no_stat_yet"),
      actions: [{ label: t("add_first_observation"), onPress: onAdd }],
    };
  };

  const emptyProps = getEmptyProps();

  const renderItem = useCallback(
    ({ item, index }) => <StatCard item={item} index={index} seen={seen} />,
    [],
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 12 }}
      ListEmptyComponent={emptyProps ? <EmptyState {...emptyProps} /> : null}
    />
  );
};

export default Stats;
