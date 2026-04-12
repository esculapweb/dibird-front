import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../../store/theme-context";

const BackgroundScene = () => {
  const { Colors, isDark } = useTheme();
  const blobColor = Colors.main100;
const o1 = isDark ? 0.07 : 0.11;
  const o2 = isDark ? 0.04 : 0.07;
  const o3 = isDark ? 0.05 : 0.08;
  const o4 = isDark ? 0.03 : 0.05;

  return (
    <View
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents="none"
    >
      {/* Верхний правый */}
      <Svg
        style={{ position: "absolute", top: -40, right: -40, width: 220, height: 220 }}
        viewBox="0 0 220 220"
      >
        <Path
          d="M140 15 C175 5, 215 35, 210 80 C205 125, 165 145, 130 130 C95 115, 75 80, 90 45 C100 20, 118 22, 140 15Z"
          fill={blobColor} opacity={o1}
        />
        <Path
          d="M150 25 C182 16, 208 48, 200 88 C193 125, 158 140, 126 124 C96 109, 82 76, 96 44 C108 17, 128 32, 150 25Z"
          fill={blobColor} opacity={o2}
        />
      </Svg>

      {/* Нижний левый */}
      <Svg
        style={{ position: "absolute", bottom: -40, left: -40, width: 240, height: 240 }}
        viewBox="0 0 240 240"
      >
        <Path
          d="M30 210 C-5 195, -15 155, 10 120 C35 85, 80 75, 115 95 C148 114, 155 155, 135 185 C115 212, 65 225, 30 210Z"
          fill={blobColor} opacity={o1}
        />
        <Path
          d="M35 200 C5 186, -5 150, 18 118 C40 88, 82 80, 112 98 C142 116, 146 152, 128 180 C110 207, 64 214, 35 200Z"
          fill={blobColor} opacity={o2}
        />
      </Svg>

      {/* Средний правый — тихий акцент */}
      <Svg
        style={{ position: "absolute", top: "35%", right: -50, width: 160, height: 160 }}
        viewBox="0 0 160 160"
      >
        <Path
          d="M120 20 C148 35, 158 75, 145 108 C132 138, 100 148, 75 135 C50 122, 42 88, 58 60 C72 35, 98 8, 120 20Z"
          fill={blobColor} opacity={o3}
        />
        <Path
          d="M115 30 C140 44, 148 80, 136 110 C124 138, 95 145, 72 132 C50 120, 45 88, 60 62 C74 38, 95 18, 115 30Z"
          fill={blobColor} opacity={o4}
        />
      </Svg>

      {/* Верхний левый — маленький */}
      <Svg
        style={{ position: "absolute", top: -20, left: -30, width: 140, height: 140 }}
        viewBox="0 0 140 140"
      >
        <Path
          d="M25 110 C-5 95, -8 58, 15 35 C38 12, 75 15, 95 38 C112 58, 108 95, 85 110 C62 125, 48 122, 25 110Z"
          fill={blobColor} opacity={o3}
        />
      </Svg>
    </View>
  );
};

export default BackgroundScene;