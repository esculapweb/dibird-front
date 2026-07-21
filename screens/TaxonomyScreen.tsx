import { useLayoutEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";

import Layout from "../components/ui/Layout";
import TaxonChildrenList from "../components/Taxonomy/TaxonChildrenList";
import { useTheme, ThemeColors } from "../store/theme-context";
import { AppStackNavigationProp, AppStackRouteProp } from "../types";

const RANK_TITLE_KEY: Record<number, string> = {
  2: "orders",
  3: "families",
  4: "genera",
  5: "species",
};

const RANK_EMPTY_KEY: Record<number, string> = {
  2: "no_orders_found",
  3: "no_families_found",
  4: "no_genera_found",
  5: "no_species_found",
};

const TaxonomyScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Taxonomy">>();
  const { rank, parentSegment, parentRank, extinct, title } = route.params;
  const isRoot = rank === 2 && !parentSegment && !extinct;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title ?? t(RANK_TITLE_KEY[rank]),
    });
  }, [navigation, title, rank, t]);

  return (
    <Layout>
      <TaxonChildrenList
        rank={rank}
        parent={
          parentSegment && parentRank
            ? { segment: parentSegment, rank: parentRank }
            : null
        }
        extinct={extinct}
        errorTitle={t("taxonomy_unavailable")}
        emptyMessage={t(RANK_EMPTY_KEY[rank])}
        listHeader={
          isRoot ? (
            <Pressable
              onPress={() =>
                navigation.navigate("Taxonomy", {
                  rank: 5,
                  extinct: true,
                  title: t("extinct_species"),
                })
              }
            >
              <Text style={styles.extinctLink}>{t("extinct_species")} →</Text>
            </Pressable>
          ) : undefined
        }
      />
    </Layout>
  );
};

export default TaxonomyScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    extinctLink: {
      fontSize: 13,
      color: Colors.main100,
      marginBottom: 8,
    },
  });
