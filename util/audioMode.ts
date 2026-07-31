import { setAudioModeAsync } from "expo-audio";

// expo-audio трогает AVAudioSession только внутри setAudioModeAsync: без вызова
// категория остаётся системной (soloAmbient), то есть запись молчит при
// включённом беззвучном режиме — а ползунок при этом едет, и выглядит это как
// сломанное приложение, а не как выключенный звук.
//
// Живёт отдельным модулем, а не внутри TaxonSoundRow: вызывать это на старте
// приложения нельзя (expo-audio намеренно не попадает в стартовый бандл, см.
// constants/catalogScreens.ts), значит зовём с первого воспроизведения — и
// флаг «уже настроено» должен переживать перемонтирование ряда.
let configured = false;

export const ensureAudioMode = () => {
  if (configured) return;
  configured = true;

  setAudioModeAsync({
    playsInSilentMode: true,
    // Согласовано с `enableBackgroundPlayback: false` в app.config.js: на iOS
    // фоновое воспроизведение без UIBackgroundModes: audio всё равно не
    // работает, а заявлять неиспользуемый background mode — повод для отказа.
    shouldPlayInBackground: false,
    // Запись птицы слушают, а не подмешивают: чужая музыка должна встать на
    // паузу, иначе не разобрать ни то, ни другое.
    interruptionMode: "doNotMix",
  }).catch((e) => {
    // Не смогли выставить режим — запись всё равно проиграется, просто на
    // системных условиях; пробуем снова на следующем воспроизведении.
    configured = false;
    if (__DEV__) console.warn("[ensureAudioMode]", e);
  });
};
