import { Fragment } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { AppStackNavigationProp, TaxonParentCrumb } from "../../types";

interface TaxonBreadcrumbsProps {
  parents: TaxonParentCrumb[];
}

const TaxonBreadcrumbs = ({ parents }: TaxonBreadcrumbsProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();

  if (parents.length === 0) return null;

  return (
    <View style={styles.crumbs}>
      {parents.map((p, i) => (
        <Fragment key={p.parent_segment}>
          {i > 0 && <Text style={styles.separator}>·</Text>}
          <Pressable
            onPress={() =>
              navigation.navigate("TaxonGroupDetail", {
                segment: p.parent_segment,
                rank: p.depth as 2 | 3 | 4,
              })
            }
          >
            <Text style={styles.crumb}>{p.parent_name_lang}</Text>
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
};

export default TaxonBreadcrumbs;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    crumbs: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    crumb: {
      fontSize: 12,
      color: Colors.main100,
      textDecorationLine: "underline",
    },
    separator: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });
