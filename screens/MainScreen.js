import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  useWindowDimensions,
} from "react-native";

import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../store/theme-context";

const H_PAD = 16;
const SEC_GAP = 8;
const SEC_COLS = 3;

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
  const S = stylesFn(Colors);
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;
  const [showDivider, setShowDivider] = useState(false);
  const onScroll = (e) => {
    const should = e.nativeEvent.contentOffset.y > 10;
    setShowDivider((prev) => (prev === should ? prev : should));
  };

  const { width } = useWindowDimensions();

  const SEC_W = (width - H_PAD * 2 - SEC_GAP * (SEC_COLS - 1)) / SEC_COLS;

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
      name: "Лебедь-кликун",
      latin: "Cygnus cygnus",
      date: "8 апр",
    },
    {
      key: "sp2",
      emoji: "🐦",
      name: "Авдотка",
      latin: "Burhinus oedicnemus",
      date: "7 апр",
    },
    {
      key: "sp3",
      emoji: "🕊️",
      name: "Белокрылая крачка",
      latin: "Chlidonias leucopterus",
      date: "4 апр",
    },
  ];

  const sparkWeekDelta = "+5";
  const clProgress = checklist.seen / checklist.total;

  return (
    <View style={S.root}>
      {/* ── FLOATING NAVBAR ──────────────────────────────────── */}
      <View style={S.navbarAbsolute}>
        <View style={[S.navbar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ gap: 5 }}
          >
            <View style={S.burgerLine} />
            <View style={S.burgerLine} />
            <View style={S.burgerLine} />
          </TouchableOpacity>

          <TouchableOpacity
            style={S.pill}
            onPress={() => navigation.navigate("FilterSheet")}
          >
            <Text style={S.pillFlag}>🇧🇾</Text>
            <Text style={S.pillText} numberOfLines={1}>
              {t("this_year") ?? "Этот год"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          <View style={{ width: 28 }} />
        </View>
        <View style={[S.divider, { opacity: showDivider ? 1 : 0 }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: NAVBAR_HEIGHT + 6,
          paddingBottom: insets.bottom + 16,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── STATS ──────────────────────────────────────────── */}
        <View style={S.statsRow}>
          <StatCard
            value={stats.species}
            label={t("species")}
            Colors={Colors}
          />
          <StatCard
            value={stats.observations}
            label={t("observations")}
            Colors={Colors}
          />
          <StatCard
            value={stats.diaries}
            label={t("diaries")}
            Colors={Colors}
          />
          <StatCard
            value={`#${stats.rank}`}
            label={t("rating")}
            Colors={Colors}
          />
        </View>

        {/* ── SPARKLINE ──────────────────────────────────────── */}
        <View style={S.card}>
          <View style={S.sparkHead}>
            <Text style={S.sparkLabel}>
              {t("activity_30d") ?? "Активность · 30 дней"}
            </Text>
            <Text style={S.sparkValue}>
              {sparkWeekDelta} {t("this_week") ?? "эта неделя"}
            </Text>
          </View>
          <Sparkline data={SPARK_DATA} Colors={Colors} width={width} />
        </View>

        {/* ── BIRD OF THE DAY ────────────────────────────────── */}
        <TouchableOpacity
          style={S.botdCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("BirdOfDay")}
        >
          <View style={[S.botdStrip, { backgroundColor: Colors.main100 }]}>
            <View style={S.botdStripLeft}>
              <Text style={S.botdStripStar}>⭐</Text>
              <Text style={[S.botdStripTitle, { color: Colors.textOpposite }]}>
                {t("bird_of_day") ?? "Птица дня"}
              </Text>
            </View>
            <Text
              style={[
                S.botdStripSub,
                { color: Colors.textOpposite, opacity: 0.7 },
              ]}
            >
              {t("find_today") ?? "Найди сегодня"}
            </Text>
          </View>
          <View style={S.botdBody}>
            <View style={S.botdImgBox}>
              <Text style={{ fontSize: 30 }}>{birdOfDay.emoji}</Text>
            </View>
            <View style={S.botdText}>
              <Text style={S.botdName}>
                {t(birdOfDay.nameKey) ?? "Орлан-белохвост"}
              </Text>
              <Text style={S.botdLatin}>{birdOfDay.latin}</Text>
              <Text style={[S.botdHint, { color: Colors.main100 }]}>
                {t(birdOfDay.hintKey) ?? "Рядом · нет в чеклисте"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Colors.border} />
          </View>
        </TouchableOpacity>

        {/* ── CHECKLIST HERO ─────────────────────────────────── */}
        <TouchableOpacity
          style={[S.clCard, { backgroundColor: Colors.main100 }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Checklist")}
        >
          <Text
            style={[S.clTag, { color: Colors.textOpposite, opacity: 0.65 }]}
            numberOfLines={1}
          >
            {t("checklist") ?? "Чек-лист"} · {checklist.country}{" "}
            {checklist.year}
          </Text>
          <View style={S.clRow}>
            <Text style={[S.clNum, { color: Colors.textOpposite }]}>
              {checklist.seen}
              {"  "}
              <Text
                style={[S.clOf, { color: Colors.textOpposite, opacity: 0.65 }]}
              >
                {t("of") ?? "из"} {checklist.total}
              </Text>
            </Text>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={Colors.textOpposite}
              style={{ opacity: 0.4 }}
            />
          </View>
          <Text
            style={[S.clSub, { color: Colors.textOpposite, opacity: 0.65 }]}
          >
            +{checklist.newCount} {t("new_in") ?? "новых в"}{" "}
            {t(checklist.monthKey) ?? "апреле"}
          </Text>
          <View style={[S.clBarBg, { backgroundColor: Colors.mainProgressBg }]}>
            <View
              style={[
                S.clBarFill,
                {
                  width: `${Math.round(clProgress * 100)}%`,
                  backgroundColor: Colors.textOpposite,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* ── NEW SPECIES  ── */}
        <View style={S.sectionHeader}>
          <Text style={S.groupLabel}>{t("new_species") ?? "Новые виды"}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Stat")}>
            <Text style={[S.seeAll, { color: Colors.main100 }]}>
              {t("all") ?? "все"} →
            </Text>
          </TouchableOpacity>
        </View>

        <View style={S.nsList}>
          {newSpecies.map((sp, i) => (
            <TouchableOpacity
              key={sp.key}
              style={[S.nsRow, i < newSpecies.length - 1 && S.nsRowDivider]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("SpeciesDetail", { species: sp })
              }
            >
              <View
                style={[S.nsImgBox, { backgroundColor: Colors.backgroundMain }]}
              >
                <Text style={{ fontSize: 24 }}>{sp.emoji}</Text>
              </View>
              <View style={S.nsNames}>
                <Text style={S.nsCommon}>{sp.name}</Text>
                <Text style={S.nsLatin}>{sp.latin}</Text>
              </View>
              <Text style={S.nsDate}>{sp.date}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── QUICK ACTIONS ──────────────────────────────────── */}
        <Text style={[S.groupLabel, { marginTop: 8 }]}>
          {t("quick_actions") ?? "Быстрые действия"}
        </Text>
        <View style={S.quickRow}>
          <TouchableOpacity
            style={[S.qbtn, { backgroundColor: Colors.main100 }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("DiaryEditor")}
          >
            <Ionicons name="book" size={22} color={Colors.textOpposite} />
            <Text style={[S.qbtnText, { color: Colors.textOpposite }]}>
              + {t("diary") ?? "Дневник"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              S.qbtn,
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
            <Text style={[S.qbtnText, { color: Colors.textMain }]}>
              + {t("observation") ?? "Наблюдение"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── SECTIONS — FlatList numColumns=3, cross-platform ─ */}
        <Text style={S.groupLabel}>{t("sections") ?? "Разделы"}</Text>
        <FlatList
          data={SECTIONS}
          keyExtractor={(item) => item.key}
          numColumns={SEC_COLS}
          scrollEnabled={false}
          columnWrapperStyle={S.secRow}
          contentContainerStyle={S.secGrid}
          renderItem={({ item: sec, index }) => (
            <TouchableOpacity
              style={[
                S.secCard,
                { backgroundColor: Colors.primary100, width: SEC_W },
              ]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(sec.key)}
            >
              {sec.showBadge && stats.diaries > 0 && (
                <View style={[S.secBadge, { backgroundColor: Colors.main100 }]}>
                  <Text
                    style={[S.secBadgeText, { color: Colors.textOpposite }]}
                  >
                    {stats.diaries}
                  </Text>
                </View>
              )}
              <Ionicons
                name={sec.icon}
                size={30}
                color={Colors.main100}
                style={{ marginBottom: 10 }}
              />
              <Text style={[S.secLabel, { color: Colors.textSecondary }]}>
                {t(sec.labelKey)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </ScrollView>
    </View>
  );
};

export default MainScreen;

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ value, label, Colors }) => {
  const S = stylesFn(Colors);
  return (
    <View style={S.statCard}>
      <Text style={S.statNum}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
};

const Sparkline = ({ data, Colors, width }) => {
  const SPARK_H = 52;
  const INNER_W = width - H_PAD * 2 - 32;
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
    navbarAbsolute: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: Colors.backgroundMain,
    },
    navbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: H_PAD,
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
      paddingVertical: 9,
      paddingLeft: 12,
      paddingRight: 14,
      maxWidth: 200,
    },
    pillFlag: { fontSize: 17 },
    pillText: {
      fontSize: 15,
      fontWeight: "500",
      color: Colors.textMain,
      flexShrink: 1,
    },
    divider: { height: 0.5, backgroundColor: Colors.divider },

    statsRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: H_PAD,
      paddingBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 14,
      paddingHorizontal: 4,
      alignItems: "center",
    },
    statNum: { fontSize: 22, fontWeight: "600", color: Colors.textMain },
    statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

    card: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: Colors.border,
      padding: 16,
    },
    sparkHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sparkLabel: { fontSize: 13, color: Colors.textSecondary },
    sparkValue: { fontSize: 13, fontWeight: "500", color: Colors.main100 },

    botdCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 18,
      borderWidth: 0.5,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    botdStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    botdStripLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    botdStripStar: { fontSize: 16 },
    botdStripTitle: { fontSize: 15, fontWeight: "600" },
    botdStripSub: { fontSize: 13 },
    botdBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    botdImgBox: {
      width: 58,
      height: 58,
      borderRadius: 14,
      backgroundColor: Colors.backgroundMain,
      borderWidth: 0.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    botdText: { flex: 1 },
    botdName: { fontSize: 16, fontWeight: "600", color: Colors.textMain },
    botdLatin: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 3,
    },
    botdHint: { fontSize: 13, marginTop: 5 },

    clCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      borderRadius: 18,
      padding: 18,
    },
    clTag: { fontSize: 13, marginBottom: 8 },
    clRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    clNum: { fontSize: 40, fontWeight: "700", lineHeight: 44 },
    clOf: { fontSize: 16, fontWeight: "400" },
    clSub: { fontSize: 13, marginTop: 5 },
    clBarBg: { marginTop: 14, height: 5, borderRadius: 3, overflow: "hidden" },
    clBarFill: { height: "100%", borderRadius: 3 },

    // Section header row with "все →"
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    groupLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
      marginBottom: 8,
      marginTop: 4,
    },
    seeAll: { fontSize: 14, fontWeight: "500", marginRight: H_PAD },

    // New species list — rows on backgroundMain
    nsList: {
      marginBottom: 4,
    },
    nsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    nsRowDivider: { borderBottomWidth: 0.5, borderBottomColor: Colors.divider },
    nsImgBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    nsNames: { flex: 1 },
    nsCommon: { fontSize: 15, fontWeight: "500", color: Colors.textMain },
    nsLatin: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 2,
    },
    nsDate: { fontSize: 13, color: Colors.textSecondary, flexShrink: 0 },

    quickRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: H_PAD,
      marginBottom: 20,
    },
    qbtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 16,
      paddingVertical: 16,
    },
    qbtnText: { fontSize: 15, fontWeight: "600" },

    // Sections — FlatList handles columns cross-platform
    secGrid: {
      paddingHorizontal: H_PAD,
    },
    secRow: {
      justifyContent: "space-between",
      marginBottom: SEC_GAP,
    },
    secCard: {
      borderRadius: 18,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 22,
      paddingHorizontal: 8,
      alignItems: "center",
      position: "relative",
    },
    secLabel: {
      fontSize: 13,
      textAlign: "center",
      color: Colors.textSecondary,
    },
    secBadge: {
      position: "absolute",
      top: 8,
      right: 9,
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    secBadgeText: { fontSize: 11, fontWeight: "600" },
  });
