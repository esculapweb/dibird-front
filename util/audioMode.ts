import { setAudioModeAsync } from "expo-audio";

// expo-audio touches AVAudioSession only inside setAudioModeAsync: without a call
// the category stays the system one (soloAmbient), that is, a recording stays
// silent while the silent switch is on — and the slider moves meanwhile, which
// looks like a broken app rather than muted sound.
//
// It lives as a separate module rather than inside TaxonSoundRow: this must not
// be called at app start (expo-audio is deliberately kept out of the start
// bundle, see constants/catalogScreens.ts), so it is called from the first
// playback — and the "already configured" flag has to survive the row being
// remounted.
let configured = false;

export const ensureAudioMode = () => {
  if (configured) return;
  configured = true;

  setAudioModeAsync({
    playsInSilentMode: true,
    // Agreed with `enableBackgroundPlayback: false` in app.config.js: on iOS
    // background playback does not work without UIBackgroundModes: audio anyway,
    // and declaring an unused background mode is grounds for a rejection.
    shouldPlayInBackground: false,
    // A bird recording is listened to, not mixed in: someone else's music must
    // pause, otherwise neither can be made out.
    interruptionMode: "doNotMix",
  }).catch((e) => {
    // We could not set the mode — the recording will play anyway, just on the
    // system's terms; we try again on the next playback.
    configured = false;
    if (__DEV__) console.warn("[ensureAudioMode]", e);
  });
};
