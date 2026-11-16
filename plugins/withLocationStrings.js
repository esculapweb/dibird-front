const { withInfoPlist, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Writes the whole InfoPlist.strings per language, so every localized purpose
// string has to be here, not only the location one (the file name is
// historical). The English copies of the microphone/speech strings mirror
// MICROPHONE_USAGE / SPEECH_RECOGNITION_USAGE in app.config.js.
const strings = {
  en: [
    `"NSLocationWhenInUseUsageDescription" = "DiBird uses your location to sort bird watching spots by distance from you and save them on the map.";`,
    `"NSMicrophoneUsageDescription" = "DiBird uses the microphone so you can name the birds you see by voice when your hands are busy, for example to add a species to an observation or a checklist.";`,
    `"NSSpeechRecognitionUsageDescription" = "DiBird uses speech recognition to turn the bird names you say into species in your observations and checklists.";`,
  ].join("\n"),
  ru: [
    `"NSLocationWhenInUseUsageDescription" = "DiBird использует геолокацию для сортировки точек наблюдений по удалённости от вас и сохранения их на карте.";`,
    `"NSMicrophoneUsageDescription" = "DiBird использует микрофон, чтобы вы могли называть увиденных птиц голосом, когда руки заняты, — например, добавить вид в наблюдение или чек-лист.";`,
    `"NSSpeechRecognitionUsageDescription" = "DiBird использует распознавание речи, чтобы превращать названные вами птиц в виды в наблюдениях и чек-листах.";`,
  ].join("\n"),
};

module.exports = (config) =>
  withDangerousMod(config, [
    "ios",
    (config) => {
      for (const [lang, content] of Object.entries(strings)) {
        const dir = path.join(
          config.modRequest.platformProjectRoot,
          config.modRequest.projectName,
          `${lang}.lproj`,
        );
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "InfoPlist.strings"), content, "utf8");
      }
      return config;
    },
  ]);
