const {
  AndroidConfig,
  withAndroidManifest,
  withInfoPlist,
} = require("@expo/config-plugins");

// Стартовые настройки меню разработчика (expo-dev-menu) для dev-client'а.
//
// По умолчанию dev-client открывает своё меню при каждом запуске и рисует
// поверх приложения плавающую шестерёнку. Шестерёнка перекрывает кнопки в
// правом верхнем углу — в редакторе наблюдения это кнопка сохранения, и тап
// по ней открывал меню вместо отправки формы. e2e-сценариям приходилось
// разбирать это руками на каждом флоу: `launchApp: clearState` стирает
// UserDefaults / SharedPreferences, где меню хранит своё состояние, так что
// выключенная в прошлый раз шестерёнка возвращалась снова.
//
// Ключи читаются нативным кодом как *значения по умолчанию* — из Info.plist
// на iOS (`DevMenuPreferences.setup`) и из <meta-data> манифеста на Android
// (`DevMenuDefaultPreferences.metaDataBool`). Ручное переключение тумблера в
// самом меню по-прежнему главнее: это дефолт, а не запрет.
//
// Имена ключей одни и те же на обеих платформах, поэтому и задаются здесь
// одним списком — разъехавшись, они дали бы разное поведение iOS и Android
// при молчаливом отсутствии ошибки.
//
// В preview/production сборках expo-dev-menu нет вовсе, там ключи просто
// лежат мёртвым грузом — отдельного ветвления по варианту не требуют.
const DEV_MENU_DEFAULTS = {
  // Плавающая шестерёнка («Tools button»).
  EXDevMenuShowFloatingActionButton: false,
  // Открывать ли меню на старте. Одного этого флага мало: обе платформы
  // показывают меню при `showsAtLaunch || !isOnboardingFinished`, поэтому
  // онбординг тоже приходится помечать пройденным — иначе меню всё равно
  // встретит каждый чистый запуск, просто уже своим приветственным экраном.
  EXDevMenuShowsAtLaunch: false,
  EXDevMenuIsOnboardingFinished: true,
};

module.exports = function withDevMenuDefaults(config) {
  const withIos = withInfoPlist(config, (config) => {
    Object.assign(config.modResults, DEV_MENU_DEFAULTS);
    return config;
  });

  return withAndroidManifest(withIos, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );

    for (const [name, value] of Object.entries(DEV_MENU_DEFAULTS)) {
      // Строкой, а не булевым: в XML всё равно уедет текст, а "true"/"false"
      // aapt разбирает обратно в boolean — именно его ждёт getBoolean() на
      // той стороне.
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        name,
        String(value),
      );
    }

    return config;
  });
};
