import { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { ThemeColors } from "../../store/theme-context";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_WIDTH = 40;
const CELL_GAP = 4;
const CELL_STRIDE = CELL_WIDTH + CELL_GAP;
// Show ~5 cells before fading — enough to hint that more exist
const VISIBLE_WIDTH = CELL_STRIDE * 5 + CELL_WIDTH / 2;

interface HourPickerProps {
  value: number;
  onChange: (h: number) => void;
  colors: ThemeColors;
}
 
export function HourPicker({ value, onChange, colors }: HourPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const styles = stylesFn(colors);

  // Scroll to selected hour (centered) when component mounts or value changes
  useEffect(() => {
    const offset = Math.max(0, value * CELL_STRIDE - VISIBLE_WIDTH / 2 + CELL_WIDTH / 2);
    // Small delay so ScrollView has finished layout
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x: offset, animated: false }), 50);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        style={{ width: VISIBLE_WIDTH }}
        contentContainerStyle={styles.pickerWrap}
        indicatorStyle="default"
      >
        {HOURS.map((h) => {
          const active = value === h;
          return (
            <TouchableOpacity
              key={h}
              onPress={() => onChange(h)}
              style={[styles.cell, active ? styles.cellActive : styles.cellInactive]}
              hitSlop={4}
            >
              <Text style={[styles.cellText, active ? styles.cellTextActive : styles.cellTextInactive]}>
                {String(h).padStart(2, "0")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Right-edge fade to signal scrollability */}
      <View style={styles.fadeRight} pointerEvents="none" />
    </View>
  );
}

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { position: "relative" },
    pickerWrap: { flexDirection: "row", gap: CELL_GAP, paddingRight: 16 },
    cell: {
      width: CELL_WIDTH,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    cellActive: { backgroundColor: Colors.main100 },
    cellInactive: { backgroundColor: Colors.primary200 },
    cellText: { fontSize: 13, fontWeight: "500" },
    cellTextActive: { color: Colors.primary100 },
    cellTextInactive: { color: Colors.textSecondary },
    fadeRight: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 28,
      // Симулируем fade через opacity overlay цвета фона
      // Используем borderRadius чтобы не срезать ячейки
      backgroundColor: Colors.primary100,
      opacity: 0.6,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
  });