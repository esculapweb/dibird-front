import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";

import { useTheme } from "../../store/theme-context";
import { ActivityGroup } from "../../types";
import {
  axisLabelIndexes,
  formatAxisLabel,
  niceMax,
} from "../../util/activityPeriods";

const HEIGHT = 200;
const Y_GUTTER = 28;
const X_GUTTER = 24;
const TOP_PAD = 8;
const MIN_BAR_H = 2;

interface ActivityChartProps {
  data: number[];
  periods: string[];
  group: ActivityGroup;
  width: number;
  selected: number | null;
  onSelect: (index: number) => void;
}

const ActivityChart = ({
  data,
  periods,
  group,
  width,
  selected,
  onSelect,
}: ActivityChartProps) => {
  const { Colors } = useTheme();

  const plotW = Math.max(width - Y_GUTTER, 1);
  const plotH = HEIGHT - X_GUTTER - TOP_PAD;
  const slot = plotW / Math.max(data.length, 1);
  const gap = Math.min(2, slot * 0.25);
  const barW = Math.max(slot - gap, 1);

  const yMax = niceMax(Math.max(...data, 0));
  const ticks = yMax > 1 ? [0, yMax / 2, yMax] : [0, yMax];
  const labelIndexes = useMemo(
    () => axisLabelIndexes(data.length),
    [data.length],
  );

  const yOf = (value: number) => TOP_PAD + plotH - (value / yMax) * plotH;

  return (
    <View testID="activity-chart">
      <Svg width={width} height={HEIGHT}>
        {ticks.map((tick) => (
          <G key={tick}>
            <Line
              x1={Y_GUTTER}
              x2={width}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke={Colors.border}
              strokeWidth={tick === 0 ? 1 : 0.5}
            />
            <SvgText
              x={Y_GUTTER - 6}
              y={yOf(tick) + 4}
              fontSize={10}
              fill={Colors.textSecondary}
              textAnchor="end"
            >
              {tick}
            </SvgText>
          </G>
        ))}

        {data.map((value, i) => {
          const x = Y_GUTTER + i * slot + gap / 2;
          const h = value > 0 ? Math.max((value / yMax) * plotH, MIN_BAR_H) : 0;
          const isSelected = i === selected;
          return (
            <G key={i} onPress={() => onSelect(i)}>
              {/* Full-height transparent hit area: a one-observation bar is
                  only a couple of pixels tall, too small to tap on its own. */}
              <Rect
                x={Y_GUTTER + i * slot}
                y={TOP_PAD}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              {/* The selection is marked below the axis, not with a band
                  behind the bar: a full-height band read as one more, taller
                  bar — and the latest column is selected by default. */}
              {isSelected && (
                <Circle
                  cx={Y_GUTTER + i * slot + slot / 2}
                  cy={TOP_PAD + plotH + 4}
                  r={2.5}
                  fill={Colors.main100}
                  testID="activity-chart-marker"
                />
              )}
              {h > 0 && (
                <Rect
                  x={x}
                  y={TOP_PAD + plotH - h}
                  width={barW}
                  height={h}
                  rx={Math.min(3, barW / 2)}
                  fill={Colors.main100}
                  opacity={selected === null || isSelected ? 1 : 0.45}
                />
              )}
            </G>
          );
        })}

        {labelIndexes.map((i) =>
          periods[i] ? (
            <SvgText
              key={i}
              x={
                i === data.length - 1
                  ? Y_GUTTER + plotW
                  : Y_GUTTER + i * slot + slot / 2
              }
              y={HEIGHT - 4}
              fontSize={10}
              fill={Colors.textSecondary}
              textAnchor={i === data.length - 1 ? "end" : "middle"}
            >
              {formatAxisLabel(periods[i], group)}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
};

export default ActivityChart;
