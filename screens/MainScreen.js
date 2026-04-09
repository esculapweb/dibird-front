import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../store/theme-context";

const { width } = Dimensions.get("window");

const SPARK_DATA = [
  1, 2, 1, 3, 2, 1, 4, 2, 3, 5, 3, 2, 1, 3, 2, 4, 3, 2, 1, 2, 4, 2, 1, 3, 4, 3,
  2, 4, 3, 5,
];

const SECTIONS = [
  { key: "Observations", icon: "binoculars", labelKey: "observations" },
  { key: "Places", icon: "location", labelKey: "places" },
  { key: "Stat", icon: "stats-chart", labelKey: "statistics" },
  { key: "Diaries", icon: "book", labelKey: "diaries", showBadge: true },
  { key: "Rating", icon: "trophy", labelKey: "rating" },
  { key: "Checklist", icon: "checkbox", labelKey: "checklist" },
];

// ─────────────────────────────────────────────────────────────────────────────
const MainScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  // Mock data — replace with store / API
  const stats = { species: 23, observations: 37, diaries: 10, rank: 1 };
  const checklist = {
    country: "Беларусь",
    year: 2026,
    seen: 23,
    total: 347,
    newCount: 5,
    monthKey: "april",
  };
  const birdOfDay = {
    emoji: "🦅",
    nameKey: "bird_of_day_name",
    latin: "Haliaeetus albicilla",
    hintKey: "bird_of_day_hint",
  };
  const newSpecies = [
    {
      key: "sp1",
      emoji: "🦢",
      nameKey: "sp1",
      latin: "Cygnus cygnus",
      date: "8 апр",
    },
    {
      key: "sp2",
      emoji: "🐦",
      nameKey: "sp2",
      latin: "Burhinus oedicnemus",
      date: "7 апр",
    },
    {
      key: "sp3",
      emoji: "🕊️",
      nameKey: "sp3",
      latin: "Chlidonias leucopterus",
      date: "4 апр",
    },
  ];
  const sparkWeekDelta = "+5";
  const clProgress = checklist.seen / checklist.total;
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = 60 + insets.top;
  const [showDivider, setShowDivider] = useState(false);
  const onScroll = (e) => {
    const shouldShow = e.nativeEvent.contentOffset.y > 10;
    setShowDivider((prev) => (prev === shouldShow ? prev : shouldShow));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.navbarAbsolute]}>
        <View
          style={[
            styles.navbar,
            {
              paddingTop: insets.top + 8,
              backgroundColor: Colors.backgroundMain,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ gap: 5 }}
          >
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pill}
            onPress={() => navigation.navigate("FilterSheet")}
          >
            <Text style={styles.pillFlag}>🇧🇾</Text>
            <Text style={styles.pillText} numberOfLines={1}>
              {t("this_year") ?? "Этот год"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={13}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          <View style={{ width: 28 }} />
        </View>

        <View style={[styles.divider, { opacity: showDivider ? 1 : 0 }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: NAVBAR_HEIGHT }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── STATS ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            value={stats.species}
            label={t("species") ?? "Виды"}
            Colors={Colors}
          />
          <StatCard
            value={stats.observations}
            label={t("observations") ?? "Наблюдения"}
            Colors={Colors}
          />
          <StatCard
            value={stats.diaries}
            label={t("diaries") ?? "Дневники"}
            Colors={Colors}
          />
          <StatCard
            value={`#${stats.rank}`}
            label={t("rating") ?? "Рейтинг"}
            Colors={Colors}
          />
        </View>

        {/* ── SPARKLINE ──────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sparkHead}>
            <Text style={styles.sparkLabel}>
              {t("activity_30d") ?? "Активность · 30 дней"}
            </Text>
            <Text style={styles.sparkValue}>
              {sparkWeekDelta} {t("this_week") ?? "эта неделя"}
            </Text>
          </View>
          <Sparkline data={SPARK_DATA} Colors={Colors} />
        </View>

        {/* ── BIRD OF THE DAY ────────────────────────────────── */}
        <TouchableOpacity
          style={styles.botdCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("BirdOfDay")}
        >
          <View style={[styles.botdStrip, { backgroundColor: Colors.main100 }]}>
            <View style={styles.botdStripLeft}>
              <Text style={styles.botdStripStar}>⭐</Text>
              <Text
                style={[styles.botdStripTitle, { color: Colors.textOpposite }]}
              >
                {t("bird_of_day") ?? "Птица дня"}
              </Text>
            </View>
            <Text
              style={[
                styles.botdStripSub,
                { color: Colors.textOpposite, opacity: 0.7 },
              ]}
            >
              {t("find_today") ?? "Найди сегодня"}
            </Text>
          </View>
          <View style={styles.botdBody}>
            <View style={styles.botdImgBox}>
              <Text style={{ fontSize: 28 }}>{birdOfDay.emoji}</Text>
            </View>
            <View style={styles.botdText}>
              <Text style={styles.botdName}>
                {t(birdOfDay.nameKey) ?? "Орлан-белохвост"}
              </Text>
              <Text style={styles.botdLatin}>{birdOfDay.latin}</Text>
              <Text style={[styles.botdHint, { color: Colors.main100 }]}>
                {t(birdOfDay.hintKey) ?? "Рядом · нет в чеклисте"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.border} />
          </View>
        </TouchableOpacity>

        {/* ── CHECKLIST HERO ─────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.clCard, { backgroundColor: Colors.main100 }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Checklist")}
        >
          <Text
            style={[
              styles.clTag,
              { color: Colors.textOpposite, opacity: 0.65 },
            ]}
            numberOfLines={1}
          >
            {t("checklist") ?? "Чек-лист"} · {checklist.country}{" "}
            {checklist.year}
          </Text>
          <View style={styles.clRow}>
            <Text style={[styles.clNum, { color: Colors.textOpposite }]}>
              {checklist.seen}
              {"  "}
              <Text
                style={[
                  styles.clOf,
                  { color: Colors.textOpposite, opacity: 0.65 },
                ]}
              >
                {t("of") ?? "из"} {checklist.total}
              </Text>
            </Text>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={Colors.textOpposite}
              style={{ opacity: 0.4 }}
            />
          </View>
          <Text
            style={[
              styles.clSub,
              { color: Colors.textOpposite, opacity: 0.65 },
            ]}
          >
            +{checklist.newCount} {t("new_in") ?? "новых в"}{" "}
            {t(checklist.monthKey) ?? "апреле"}
          </Text>
          <View style={styles.clBarBg}>
            <View
              style={[
                styles.clBarFill,
                {
                  width: `${Math.round(clProgress * 100)}%`,
                  backgroundColor: Colors.textOpposite,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* ── NEW SPECIES ────────────────────────────────────── */}
        <View style={styles.nsCard}>
          <View style={[styles.nsHead, { backgroundColor: Colors.main300 }]}>
            <Text style={[styles.nsHeadTitle, { color: Colors.main100 }]}>
              {t("new_species") ?? "Новые виды"}
            </Text>
            <View style={[styles.nsBadge, { backgroundColor: Colors.main100 }]}>
              <Text
                style={[styles.nsBadgeText, { color: Colors.textOpposite }]}
              >
                +{checklist.newCount} {t(checklist.monthKey) ?? "апрель"}
              </Text>
            </View>
          </View>
          {newSpecies.map((sp, i) => (
            <TouchableOpacity
              key={sp.key}
              style={[
                styles.nsRow,
                i < newSpecies.length - 1 && styles.nsRowDivider,
              ]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("SpeciesDetail", { species: sp })
              }
            >
              <View style={styles.nsImgBox}>
                <Text style={{ fontSize: 22 }}>{sp.emoji}</Text>
              </View>
              <View style={styles.nsNames}>
                <Text style={styles.nsCommon}>
                  {t(sp.nameKey) ?? sp.nameKey}
                </Text>
                <Text style={styles.nsLatin}>{sp.latin}</Text>
              </View>
              <Text style={styles.nsDate}>{sp.date}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── QUICK ACTIONS ──────────────────────────────────── */}
        <Text style={styles.groupLabel}>
          {t("quick_actions") ?? "Быстрые действия"}
        </Text>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.qbtn, { backgroundColor: Colors.main100 }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("DiaryEditor")}
          >
            <Ionicons name="book" size={22} color={Colors.textOpposite} />
            <Text style={[styles.qbtnText, { color: Colors.textOpposite }]}>
              + {t("diary") ?? "Дневник"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.qbtn,
              {
                backgroundColor: Colors.primary100,
                borderWidth: 0.5,
                borderColor: Colors.border,
              },
            ]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("ObservationEditor")}
          >
            <Ionicons name="binoculars" size={22} color={Colors.textMain} />
            <Text style={[styles.qbtnText, { color: Colors.textMain }]}>
              + {t("observation") ?? "Наблюдение"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── SECTIONS ───────────────────────────────────────── */}
        <Text style={styles.groupLabel}>{t("sections") ?? "Разделы"}</Text>
        <View style={styles.sectionsGrid}>
          {SECTIONS.map((sec) => (
            <TouchableOpacity
              key={sec.key}
              style={[styles.secCard, { backgroundColor: Colors.primary100 }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(sec.key)}
            >
              {sec.showBadge && stats.diaries > 0 && (
                <View
                  style={[styles.secBadge, { backgroundColor: Colors.accent }]}
                >
                  <Text
                    style={[
                      styles.secBadgeText,
                      { color: Colors.textOpposite },
                    ]}
                  >
                    {stats.diaries}
                  </Text>
                </View>
              )}
              <Ionicons
                name={sec.icon}
                size={28}
                color={Colors.main100}
                style={{ marginBottom: 8 }}
              />
              <Text style={[styles.secLabel, { color: Colors.textSecondary }]}>
                {t(sec.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default MainScreen;

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ value, label, Colors }) => {
  const styles = stylesFn(Colors);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

const Sparkline = ({ data, Colors }) => {
  const SPARK_H = 48;
  const INNER_W = width - 16 * 2 - 14 * 2;
  const barW = Math.max(
    Math.floor((INNER_W - data.length * 2) / data.length),
    3,
  );
  const max = Math.max(...data);
  const RECENT = data.length - 7;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        height: SPARK_H,
        gap: 2,
      }}
    >
      {data.map((v, i) => {
        const h = Math.max(Math.round((v / max) * SPARK_H), 4);
        const isRecent = i >= RECENT;
        const isTall = v >= max * 0.75;
        const bg = isRecent
          ? Colors.main100
          : isTall
            ? Colors.main300
            : Colors.border;
        return (
          <View
            key={i}
            style={{
              width: barW,
              height: h,
              borderRadius: 3,
              backgroundColor: bg,
            }}
          />
        );
      })}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const stylesFn = (Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.backgroundMain },
    scroll: { paddingBottom: 48 },

    navbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    burgerLine: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: Colors.textMain,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: Colors.primary100,
      borderWidth: 0.5,
      borderColor: Colors.border,
      borderRadius: 20,
      paddingVertical: 8,
      paddingLeft: 10,
      paddingRight: 12,
      maxWidth: 190,
    },
    pillFlag: { fontSize: 16 },
    pillText: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.textMain,
      flexShrink: 1,
    },
    divider: {
      height: 0.5,
      backgroundColor: Colors.divider,
    },

    statsRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 12,
      paddingHorizontal: 4,
      alignItems: "center",
    },
    statNum: { fontSize: 20, fontWeight: "600", color: Colors.textMain },
    statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },

    card: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      padding: 14,
    },
    sparkHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sparkLabel: { fontSize: 11, color: Colors.textSecondary },
    sparkValue: { fontSize: 11, fontWeight: "500", color: Colors.main100 },

    botdCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    botdStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    botdStripLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    botdStripStar: { fontSize: 14 },
    botdStripTitle: { fontSize: 13, fontWeight: "500" },
    botdStripSub: { fontSize: 11 },
    botdBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    botdImgBox: {
      width: 54,
      height: 54,
      borderRadius: 13,
      backgroundColor: Colors.backgroundMain,
      borderWidth: 0.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    botdText: { flex: 1 },
    botdName: { fontSize: 14, fontWeight: "500", color: Colors.textMain },
    botdLatin: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 2,
    },
    botdHint: { fontSize: 11, marginTop: 4 },

    clCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      padding: 16,
    },
    clTag: { fontSize: 11, marginBottom: 6 },
    clRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    clNum: { fontSize: 36, fontWeight: "600", lineHeight: 40 },
    clOf: { fontSize: 15, fontWeight: "400" },
    clSub: { fontSize: 11, marginTop: 4 },
    clBarBg: {
      marginTop: 12,
      height: 5,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.25)",
      overflow: "hidden",
    },
    clBarFill: { height: "100%", borderRadius: 3 },

    nsCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    nsHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    nsHeadTitle: { fontSize: 13, fontWeight: "500" },
    nsBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    nsBadgeText: { fontSize: 11, fontWeight: "500" },
    nsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    nsRowDivider: { borderBottomWidth: 0.5, borderBottomColor: Colors.divider },
    nsImgBox: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: Colors.backgroundMain,
      borderWidth: 0.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    nsNames: { flex: 1 },
    nsCommon: { fontSize: 13, fontWeight: "500", color: Colors.textMain },
    nsLatin: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 1,
    },
    nsDate: { fontSize: 11, color: Colors.textSecondary, flexShrink: 0 },

    groupLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.textMain,
      marginLeft: 16,
      marginBottom: 10,
      marginTop: 4,
    },

    quickRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    qbtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      paddingVertical: 14,
    },
    qbtnText: { fontSize: 13, fontWeight: "500" },

    sectionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      justifyContent: "space-between",
    },
    secCard: {
      width: "31.5%", // вместо fixed width
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 20,
      paddingHorizontal: 8,
      alignItems: "center",
      position: "relative",
      marginBottom: 8, // вместо gap вертикали
    },
    secLabel: { fontSize: 12, textAlign: "center" },
    secBadge: {
      position: "absolute",
      top: 7,
      right: 8,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    secBadgeText: { fontSize: 10, fontWeight: "500" },

    navbarAbsolute: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      overflow: "hidden",
    },
  });
