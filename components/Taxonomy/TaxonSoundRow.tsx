import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { soundTypeParts } from "../../util/soundType";
import { ensureAudioMode } from "../../util/audioMode";
import { parseSoundLicense, xenoCantoUrl } from "../../util/soundLicense";
import { TaxonSound } from "../../types";

interface TaxonSoundRowProps {
  sound: TaxonSound;
  isActive: boolean;
  onPlay: () => void;
}

const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
};

const TaxonSoundRow = ({ sound, isActive, onPlay }: TaxonSoundRowProps) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  // Only the first letter is raised: `textTransform: "capitalize"` would also
  // hit every word after a comma, and a translated tag ("позывка в полёте")
  // is a phrase, not a title.
  const typeLabel = useMemo(() => {
    const label = soundTypeParts(sound.type)
      .map(
        (part) =>
          `${part.key ? t(part.key) : part.raw}${part.uncertain ? "?" : ""}`,
      )
      .join(", ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [sound.type, t]);
  // Recordings are CC-licensed, and every one of those licences asks for the
  // same three things: author, source and the licence itself. Author is the
  // meta line below, source is the XC link, licence is this label — dropping
  // any of them makes the playback itself non-compliant.
  const license = useMemo(
    () => parseSoundLicense(sound.license),
    [sound.license],
  );
  // Only a subset of recordings are mirrored locally (sound.sound); the rest
  // stream directly from Xeno-canto's public, unauthenticated download route.
  const uri = sound.sound ?? `https://xeno-canto.org/${sound.xeno_id}/download`;
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  // Holds the thumb position while a drag is in progress, so the status
  // updates streaming in don't yank it back under the finger.
  const [seekTo, setSeekTo] = useState<number | null>(null);
  // Only some recordings are mirrored on our media server; the rest stream
  // from Xeno-canto, which reports duration 0 until (and often after) the
  // clip is buffered. Keep the last real value so a momentary 0 doesn't
  // collapse the scale mid-playback.
  const [knownDuration, setKnownDuration] = useState(0);

  useEffect(() => {
    if (!isActive && status.playing) player.pause();
  }, [isActive, status.playing, player]);

  useEffect(() => {
    // Rewind on finish so the same recording can be replayed or scrubbed
    // instead of sitting at the end.
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  useEffect(() => {
    if (status.duration > 0) setKnownDuration(status.duration);
  }, [status.duration]);

  const duration = status.duration > 0 ? status.duration : knownDuration;
  const position = seekTo ?? status.currentTime ?? 0;
  // Without a duration there is nothing to scrub along: scaling the track to
  // a guess would peg the thumb at the end a second into playback.
  const seekable = duration > 0 && !status.isLive;

  const handlePress = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    ensureAudioMode();
    player.play();
    onPlay();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable onPress={handlePress} hitSlop={8}>
          <Ionicons
            name={status.playing ? "pause-circle" : "play-circle"}
            size={30}
            color={Colors.main100}
          />
        </Pressable>
        <View style={styles.info}>
          <Text style={styles.type} numberOfLines={1}>
            {typeLabel}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {sound.recorder}
            {sound.country ? `, ${sound.country}` : ""}
          </Text>
          {/* On its own line rather than appended to meta: with
              `numberOfLines={1}` a long recordist name would cut off exactly
              the attribution. */}
          <Text style={styles.credits} numberOfLines={1}>
            <Text
              style={styles.link}
              onPress={() => Linking.openURL(xenoCantoUrl(sound.xeno_id))}
              testID={`sound-source-${sound.xeno_id}`}
            >
              {`XC${sound.xeno_id}`}
            </Text>
            {license ? " · " : ""}
            {license ? (
              <Text
                style={license.url ? styles.link : undefined}
                onPress={
                  license.url
                    ? () => Linking.openURL(license.url as string)
                    : undefined
                }
                testID={`sound-license-${sound.xeno_id}`}
              >
                {license.label}
              </Text>
            ) : null}
          </Text>
        </View>
      </View>

      {isActive && (
        <View style={styles.player}>
          <Text style={styles.time}>{formatSeconds(position)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={seekable ? duration : 1}
            value={seekable ? position : 0}
            disabled={!seekable}
            onSlidingStart={() => setSeekTo(position)}
            onValueChange={setSeekTo}
            onSlidingComplete={(value) => {
              player.seekTo(value);
              setSeekTo(null);
            }}
            minimumTrackTintColor={Colors.main100}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={seekable ? Colors.main100 : Colors.border}
            testID={`sound-slider-${sound.xeno_id}`}
          />
          <Text style={styles.time}>
            {seekable ? formatSeconds(duration) : "--:--"}
          </Text>
        </View>
      )}
    </View>
  );
};

export default TaxonSoundRow;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { paddingVertical: 6 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    info: { flex: 1 },
    type: {
      fontSize: 13,
      color: Colors.textMain,
    },
    meta: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    credits: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    link: { textDecorationLine: "underline" },
    player: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    slider: { flex: 1, height: 28 },
    time: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontVariant: ["tabular-nums"],
      minWidth: 34,
      textAlign: "center",
    },
  });
