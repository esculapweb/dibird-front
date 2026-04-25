const { withInfoPlist, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const strings = {
  en: `"NSLocationWhenInUseUsageDescription" = "DiBird uses your location to sort bird watching spots by distance from you and save them on the map.";`,
  ru: `"NSLocationWhenInUseUsageDescription" = "DiBird использует геолокацию для сортировки точек наблюдений по удалённости от вас и сохранения их на карте.";`,
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
