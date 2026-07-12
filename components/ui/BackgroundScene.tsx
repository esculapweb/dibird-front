import { View, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../store/theme-context";

const { width, height } = Dimensions.get("screen");

const BackgroundScene = () => {
  const { Colors, isDark } = useTheme();
  const color = Colors.main100;
  const o1 = isDark ? 0.06 : 0.09;
  const o2 = isDark ? 0.04 : 0.05;
  const o3 = isDark ? 0.01 : 0.03;

  const W = width;
  const H = height;

const ring = (cx: number, cy: number, rOuter: number, rInner: number): string => {
    const o = `M ${cx + rOuter} ${cy} A ${rOuter} ${rOuter} 0 1 0 ${cx - rOuter} ${cy} A ${rOuter} ${rOuter} 0 1 0 ${cx + rOuter} ${cy} Z`;
    const i = `M ${cx + rInner} ${cy} A ${rInner} ${rInner} 0 1 0 ${cx - rInner} ${cy} A ${rInner} ${rInner} 0 1 0 ${cx + rInner} ${cy} Z`;
    return `${o} ${i}`;
  };

  const gap = W * 0.06;
  const thickness = W * 0.14;

  const trBase = W * 0.72;
  const blBase = W * 0.85;

  return (
    <View
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents="none"
    >
      <Svg
        style={{ position: "absolute", top: 0, left: 0, width: W, height: H }}
        viewBox={`0 0 ${W} ${H}`}
      >
        <Path d={ring(W, 0, trBase,                          trBase - thickness)}            fill={color} fillRule="evenodd" opacity={o1}/>
        <Path d={ring(W, 0, trBase - thickness - gap,        trBase - thickness * 2 - gap)}  fill={color} fillRule="evenodd" opacity={o2}/>
        <Path d={ring(W, 0, trBase - thickness * 2 - gap * 2, trBase - thickness * 3 - gap * 2)} fill={color} fillRule="evenodd" opacity={o3}/>

        <Path d={ring(0, H, blBase,                          blBase - thickness)}            fill={color} fillRule="evenodd" opacity={o1}/>
        <Path d={ring(0, H, blBase - thickness - gap,        blBase - thickness * 2 - gap)}  fill={color} fillRule="evenodd" opacity={o2}/>
        <Path d={ring(0, H, blBase - thickness * 2 - gap * 2, blBase - thickness * 3 - gap * 2)} fill={color} fillRule="evenodd" opacity={o3}/>
      </Svg>
    </View>
  );
};

export default BackgroundScene;