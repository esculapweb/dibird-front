# Play Console: R8-оптимизация и инсайт про bitmap

## Context

На странице **Monitor and improve** в Play Console для релиза **19 (26.08.0)** появились
два инсайта в категории Memory usage:

1. *«Improve your app's memory and performance with R8 optimization»*
2. *«Improve your app's performance with bitmap image optimization»*

Диагностика проведена по фактам, а не по догадкам — распакован сам AAB релиза
`26.08.0` (`~/Downloads/application-99945f0f-….aab`):

| Факт | Источник |
|---|---|
| `~~R8{"r8-mode":"full","version":"8.12.14","min-api":24}` | маркер в `base/dex/classes.dex` |
| `androidGradlePluginVersion=8.12.0` | `BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties` |
| `versionName 26.08.0` | `base/manifest/AndroidManifest.xml` — тот самый релиз |
| `minifyEnabled`/`shrinkResources` = true | `app.config.js:129-142` → `android/gradle.properties` |
| `proguardFiles getDefaultProguardFile("proguard-android.txt")` | `android/app/build.gradle:121` (шаблон prebuild) |

**Причина инсайта №1**: R8 работает в full mode и шринкует, но базовый
`proguard-android.txt` содержит `-dontoptimize`. То есть код сжимается и
обфусцируется, а фаза *оптимизации* (инлайнинг, аутлайнинг, девиртуализация,
class merging) выключена. Google про этот файл пишет прямо: *«Support for
`getDefaultProguardFile("proguard-android.txt")` has been dropped, because it
includes `-dontoptimize`, which should be avoided»*
([enable-app-optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)).
`-dontoptimize` — булев флаг, его нельзя отменить из `extraProguardRules`;
единственный путь — заменить базовый файл на `proguard-android-optimize.txt`.

**Причина инсайта №2**: ложное срабатывание на код зависимостей. В JS-коде
проекта ручной загрузки/декодирования картинок нет — все сетевые изображения
идут через `expo-image` (19 мест рендера, почти везде явный `cachePolicy="disk"`),
плюс прогрев дискового кэша в `services/sync/speciesImagePrefetch.ts`.
Паттерн `new URL(...).openStream()` + `BitmapFactory.decodeStream`, который ищет
детектор Play, есть только в двух местах, и оба у нас не исполняются:

- `node_modules/expo-notifications/…/builders/DownloadImage.kt` — картинка в пуше;
  бэкенд (`/Users/esculapweb/Py/dibird/app/myapi/services/push.py:20-21`) шлёт
  только `title`/`body`, так что ветка мёртвая;
- `node_modules/@maplibre/maplibre-react-native/…/utils/BitmapUtils.java:37-46` —
  `getBitmapFromURL()` вообще **без вызывающих** внутри пакета; наш
  `components/Map/MapL.tsx` использует локальный `require("assets/marker1.png")`
  (`:198-202`) и пустой `EMPTY_MAP_STYLE` без `sprite`/`glyphs` (`:32-36`).

Итог: инсайт №2 править нечего — он снимается пометкой «Not useful». Побочный
эффект части 1 при этом играет в плюс: с включённой оптимизацией R8 мёртвый
`BitmapUtils.getBitmapFromURL` имеет шанс просто выпасть из дексов.

Отдельно, вне инсайтов Play, найдена реальная дыра в кэшировании картинок:
`<img>` внутри серверного HTML рендерится через `Image` из `react-native`, минуя
`expo-image` — без disk-кэша и без офлайн-доступности. Это часть 3.

---

## Часть 1. Включить оптимизацию R8

### 1.1 Новый config-плагин `plugins/withAndroidR8Optimization.js`

Папки `android/`/`ios/` не в репозитории, `expo-build-properties@56.0.24` умеет
только `enableMinifyInReleaseBuilds` / `enableShrinkResourcesInReleaseBuilds` /
`extraProguardRules` (см. `node_modules/expo-build-properties/build/android.js`),
поэтому подмена базового proguard-файла делается своим плагином — по образцу
существующих (`plugins/withDevMenuDefaults.js`: CommonJS, `require("@expo/config-plugins")`,
развёрнутый «почему»-комментарий в шапке на английском).

Плагин делает два мода:

1. **`withAppBuildGradle`** — в `android/app/build.gradle` заменяет
   `getDefaultProguardFile("proguard-android.txt")` на
   `getDefaultProguardFile("proguard-android-optimize.txt")`.
   Обязательно: проверить `config.modResults.language === "groovy"` и
   **бросить ошибку**, если исходная строка не найдена. Молча пропустить
   замену нельзя — билд уедет в Play неоптимизированным, и мы про это не узнаем.
2. **`withGradleProperties`** — добавить (или обновить, если уже есть)
   `android.r8.optimizedResourceShrinking=true`. Для AGP 8.12/8.13 это нужно
   указывать явно; с AGP 9.0 включается автоматически вместе с `shrinkResources`.
   Модифицируется массив `config.modResults` элементами вида
   `{ type: "property", key, value }`.

В шапке файла — комментарий (на английском) о том, что `proguard-android.txt`
несёт `-dontoptimize`, что это и был триггер инсайта Play, и что `extraProguardRules`
эту проблему не решает.

### 1.2 Регистрация в `app.config.js`

Добавить `"./plugins/withAndroidR8Optimization"` в массив `plugins` рядом с
`"./plugins/withDevMenuDefaults"` (`app.config.js:~205`). Порядок относительно
`expo-build-properties` не важен — моды применяются после генерации шаблона.

### 1.3 Риск и что с ним делать

Оптимизация R8 — единственная фаза, которая ломает рефлексию. Текущий
`proguard-rules.pro` — голый шаблон (только `com.swmansion.reanimated.**` и
`com.facebook.react.turbomodule.**`), `extraProguardRules` не задан, всё остальное
держится на consumer-rules из AAR. Consumer-правила есть у react-native,
expo-modules-core, expo-updates, expo-image, expo-notifications, expo-location,
reanimated, worklets, svg, Firebase, Google Sign-In. Их **нет** у
`@maplibre/maplibre-react-native`.

Поэтому изменение нельзя отправлять в production без прогона release-сборки.
Важная деталь, которая это упрощает: в `eas.json` **ни у одного профиля нет
`gradleCommand`**, поэтому `preview` собирает тот же release buildType с minify
и shrink — то есть preview-APK является валидной поверхностью для проверки R8.

### 1.4 Документация

В `STORE_RELEASE_STEPS.md`, §2 «Сборка и отправка», шаг 6 уже упоминает R8
(«важен из-за R8 (minify + shrink)»). Дописать туда, что с этого релиза включена
и фаза оптимизации, и что smoke-прогон preview-APK перед production обязателен.

---

## Часть 2. Инсайт про bitmap — код не трогаем

Изменений в коде не требуется. Действие в Play Console: на карточке
*«Improve your app's performance with bitmap image optimization»* нажать
**Is this useful? → No**, чтобы инсайт не висел.

Обоснование (см. Context) занести отдельным абзацем в `STORE_RELEASE_STEPS.md`
рядом с R8-заметкой — чтобы в следующий релиз не разбирать это заново.

---

## Часть 3. `<img>` из серверного HTML через `expo-image`

`react-native-render-html@6.3.4` рендерит `<img>` своим `IMGElement` поверх
`Image` из `react-native` — то есть мимо дискового кэша `expo-image`, которым
пользуется весь остальной проект. Такие картинки не переживают офлайн и не
прогреваются `speciesImagePrefetch`.

### 3.1 Новый `components/ui/HtmlImage.tsx`

Экспортирует кастомный рендерер и готовую запись для пропа `renderers`:

- тип `CustomBlockRenderer`, хук `useContentWidth()` — оба есть в v6.3.4
  (`react-native-render-html/lib/typescript/index.d.ts:24`, `shared-types.d.ts:715-742`);
- `<Image>` из `expo-image` с `cachePolicy="disk"` и `contentFit="contain"` —
  ровно как в `components/Taxonomy/SpeciesThumb.tsx` и остальных 18 местах;
- ширина = `useContentWidth()`, высота через `aspectRatio`: сперва из атрибутов
  `width`/`height` тега, если их нет — из `onLoad` (`source.width/height`),
  до загрузки — нейтральный фолбэк;
- пустой/отсутствующий `src` → `null`;
- `alt` пробрасывается в `accessibilityLabel`;
- экспорт `htmlRenderers: CustomTagRendererRecord = { img: HtmlImageRenderer }`.

Комментарий «почему» в шапке — на английском, по стилю `util/htmlStyles.ts`.

### 3.2 Подключение в трёх экранах

Во всех трёх местах вызов `RenderHtml` идентичен (`contentWidth` + `source` +
`baseStyle={htmlBaseStyle(Colors)}` + `tagsStyles={htmlTagsStyles(Colors)}`),
добавляется один проп `renderers={htmlRenderers}`:

- `screens/SpeciesDetailScreen.tsx:551-556`
- `screens/StaticScreen.tsx:72-77`
- `screens/TerritoryDetailScreen.tsx:245-250`

Новых утилит не заводить: `htmlBaseStyle`/`htmlTagsStyles` из `util/htmlStyles.ts`
остаются как есть (файл `.ts`, JSX в нём держать нельзя — отсюда отдельный
`.tsx` в `components/ui/`).

### 3.3 Тест

`components/ui/__tests__/HtmlImage.test.tsx` — рендер `RenderHtml` с
`renderers={htmlRenderers}` и HTML вида `<p>x</p><img src="https://…/a.jpg">`,
проверка, что картинка отрисована с `cachePolicy="disk"` и что `<img>` без `src`
не роняет рендер. Соседний `screens/__tests__/StaticScreen.test.tsx` уже
покрывает экран целиком — его трогать не нужно.

---

## Verification

```bash
npm run check     # tsc --noEmit + eslint
npm test          # jest
```

Проверка того, что prebuild реально применил плагин (локальная папка `android/`
сейчас протухшая, от 28 июля, ещё на compileSdk 35 — её нужно пересоздать):

```bash
npx expo prebuild --clean -p android
grep -n "proguard-android" android/app/build.gradle          # ждём -optimize.txt
grep -n "optimizedResourceShrinking" android/gradle.properties
```

Проверка самой сборки (обязательна до production — часть 1.3):

```bash
eas build -p android --profile preview      # release buildType, minify+shrink+optimize
```

На установленном preview-APK:

1. `npm run e2e:android` — батч Maestro (состав и ограничения — `RELEASE_CHECKLIST.md` §1).
   Флоу гоняются на боевой сборке, поэтому падение R8-оптимизации всплывёт как
   краш/пустой экран, а не как тихая деградация.
2. Руками добить то, чего нет в e2e и что сильнее всего завязано на рефлексию:
   карта MapLibre (нет consumer-rules), Google Sign-In, приход пуша,
   Firebase Analytics, миграции Drizzle/expo-sqlite при первом запуске.
3. Убедиться, что событие ошибки долетает в Sentry.

Проверка результата на артефакте (тот же приём, что дал диагностику):

```bash
unzip -p <новый>.aab 'BUNDLE-METADATA/com.android.tools.build.gradle/app-metadata.properties'
unzip -o -q <новый>.aab 'base/dex/classes.dex' -d /tmp/r8 && \
  strings -a /tmp/r8/base/dex/classes.dex | grep -o '~~R8{[^}]*}'
```

Ожидаем `r8-mode: full` (как и было) и заметно меньший размер дексов относительно
`26.08.0`. Окончательный вердикт по инсайту — только после того, как Play
обработает следующий релиз на Internal testing.

Часть 3 проверяется на любом экране со статикой (`StaticScreen`) при условии, что
серверный HTML содержит `<img>`: картинка должна отрисоваться и остаться видимой
после перевода устройства в авиарежим и возврата на экран (disk-кэш `expo-image`).

---

## Что осталось за рамками (найдено попутно, молча не правлю)

1. **Sentry не заливает proguard-mapping.** `app.config.js:168-175` передаёт
   `@sentry/react-native/expo` без `experimental_android.enableAndroidGradlePlugin`,
   поэтому применяется только legacy `sentry.gradle` (JS-сорсмапы). Нативные
   Android-стектрейсы в Sentry обфусцированы — и после включения оптимизации
   R8 станут ещё менее читаемыми.
2. `components/Diary/DiaryCard.tsx:85-92` — единственный `expo-image` без явного
   `cachePolicy="disk"` (дефолт совпадает, но выбивается из стиля остальных 18 мест).
3. `components/Profile/Avatar.tsx:117-121` — `manipulateAsync(uri, [], { compress: 0.8 })`
   с пустым списком операций поверх уже сжатого picker'ом (`quality: 0.8`) файла:
   двойное JPEG-пережатие без ресайза, на сервер уходит полноразмерное фото.
4. `components/Profile/Avatar.tsx:126` — файлы `pending-avatar-*.jpg` в
   `documentDirectory` не удаляются после успешного синка (`services/sync/avatarSync.ts`).
