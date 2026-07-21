import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { TaxonSound } from "../../types";

interface TaxonSoundRowProps {
  sound: TaxonSound;
  isActive: boolean;
  onPlay: () => void;
  onStop: () => void;
}

const TaxonSoundRow = ({
  sound,
  isActive,
  onPlay,
  onStop,
}: TaxonSoundRowProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const player = useAudioPlayer(sound.sound ?? null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!isActive && status.playing) player.pause();
  }, [isActive, status.playing, player]);

  useEffect(() => {
    if (isActive && status.didJustFinish) onStop();
  }, [isActive, status.didJustFinish, onStop]);

  const handlePress = () => {
    if (status.playing) {
      player.pause();
      onStop();
    } else {
      player.seekTo(0);
      player.play();
      onPlay();
    }
  };

  return (
    <View style={styles.row}>
      {!!sound.sound && (
        <Pressable onPress={handlePress} hitSlop={8}>
          <Ionicons
            name={status.playing ? "pause-circle" : "play-circle"}
            size={30}
            color={Colors.main100}
          />
        </Pressable>
      )}
      <View style={styles.info}>
        <Text style={styles.type} numberOfLines={1}>
          {sound.type}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {sound.recorder}
          {sound.country ? `, ${sound.country}` : ""}
        </Text>
      </View>
    </View>
  );
};

export default TaxonSoundRow;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    info: { flex: 1 },
    type: {
      fontSize: 13,
      color: Colors.textMain,
      textTransform: "capitalize",
    },
    meta: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
  });
