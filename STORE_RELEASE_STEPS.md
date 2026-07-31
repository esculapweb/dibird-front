# Публикация релиза в App Store и Google Play

Порядок действий в консолях магазинов. Тестовый гейт — отдельно, в
`RELEASE_CHECKLIST.md`: этот документ начинается там, где тот заканчивается,
и предполагает, что `npm run check`, `npm test` и ручные проверки уже зелёные.

Составлено под релиз **26.07.2** (первый после прод-билда 21 июля 2026).
Пункты, помеченные «разово», относятся к тому, что появилось именно в этом
релизе — каталог видов и территорий, звуки xeno-canto, импорт eBird, новые
пути App Links, `targetSdk 36`. Остальное повторяется от релиза к релизу.

## 1. App Store

### До сборки (App Store Connect, можно параллельно с билдом)

1. **App Privacy** — разово: добавить `User Content` → `Other User Content`
   (импорт eBird грузит пользовательский CSV на сервер), purpose «App
   Functionality», linked to identity. Заодно снять всё, что связано с
   камерой и микрофоном, если отмечалось раньше: этих разрешений в билде
   больше нет (`expo-image-picker` с `cameraPermission: false` /
   `microphonePermission: false` в `app.config.js`).
2. **App Review Information** — демо-аккаунт. Скрытые пункты настроек
   («Replay onboarding») открыты только профилю `9386`
   (`APP_REVIEW_PROFILE_ID` в `screens/SettingsScreen.tsx`) — в форме должен
   стоять именно он, с рабочим паролем.
3. **Notes для ревьюера** — разово: где лежит импорт eBird (Settings →
   «Импорт данных»), что записи голосов стримятся с xeno-canto под CC и
   атрибуция (автор, источник, лицензия) показана в самом списке звуков, что
   каталог открыт без регистрации (гостевой режим — ответ на 5.1.1(v)).
4. **Age Rating** — перепроверить ответы про пользовательский контент: импорт
   с включённым свитчем `make_public` публикует наблюдения в ленту сообщества.
5. Export compliance трогать не нужно: `ITSAppUsesNonExemptEncryption: false`
   в `app.config.js` → вопрос при сабмите не задаётся.

### Сборка и отправка

6. `npx expo prebuild --clean` локально — `ios/`/`android/` не в репозитории и
   успевают устареть; без этого e2e гоняются против старого манифеста.
7. `eas build -p ios --profile production` — `buildNumber` поднимается сам
   (`autoIncrement` + `appVersionSource: "remote"` в `eas.json`), marketing-
   версия берётся из `app.config.js`.
8. `eas submit -p ios --profile production` — `appleId` и `ascAppId` уже
   прописаны в `eas.json`.
9. **TestFlight перед сабмитом** — в этом релизе не формальность: поменялся
   режим аудиосессии, исчезли два разрешения, и главное — надо поставить
   билд **поверх** предыдущей версии из стора и убедиться, что миграции
   применились, а очередь синка и локальные данные целы.

### Версия и ревью

10. `+ Version` → номер из `app.config.js` (26.07.2) → заполнить **What's New**
    (обязательное поле).
11. Разово: обновить скриншоты и описание под каталог видов, территории,
    звуки и импорт eBird.
12. Прикрепить обработанный билд, ответить на вопрос об IDFA (нет), Submit for
    Review.

## 2. Google Play

### До сборки (Play Console)

1. **Data safety** — разово: добавить `Files and docs` (collected + transferred
   off device, purpose «App functionality») за импорт eBird. Проверить, что
   фото (аватар) и локация указаны корректно; снять аудио и камеру, если
   отмечались — соответствующих разрешений в билде больше нет.
2. **App content → Permissions**: декларировать нечего — `RECORD_AUDIO` и
   foreground service (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`) из манифеста ушли
   вместе с `enableBackgroundPlayback: false`. Если декларация подавалась
   раньше, свериться, что она не противоречит новому манифесту.
3. Проверить, что **SHA-256 из App Signing** не менялся: от него зависит
   верификация App Links, а путей в intent-filters стало вдвое больше
   (`/ru`-двойники, `app.config.js`). Файл на сайте —
   `https://dibird.com/.well-known/assetlinks.json`.

### Сборка и отправка

4. `eas build -p android --profile production` → AAB (`buildType:
   "app-bundle"`), `versionCode` инкрементится удалённо.
5. `eas submit -p android --profile production`. Внимание:
   `serviceAccountKeyPath` в `eas.json` **закомментирован** — submit попросит
   учётные данные интерактивно, либо AAB грузится в консоль руками. Если нужна
   автоматизация — раскомментировать и положить ключ (обязательно в
   `.gitignore`).
6. Сначала **Internal testing**, а не сразу production: это единственный
   способ получить Pre-launch report, а он важен из-за R8 (minify + shrink) и
   поднятого `targetSdk 36`.

### Раскатка

7. Production → Create new release → release notes на en и ru.
8. **Staged rollout 10–20 %**, не 100 %: в релизе две новые миграции SQLite
   (`drizzle/0013`, `0014`) и смена target API — откатить раскатку дешевле,
   чем выпускать новый билд.
9. После раскатки проверить статус верификации App Links (Deep links) и
   Sentry/Crashlytics за первые часы.

## 3. Порядок с OTA

`runtimeVersion.policy: "appVersion"`, поэтому OTA-канал привязан к
marketing-версии из `app.config.js`.

- **Не публиковать `npm run update:production` до того, как магазины раскатают
  новую версию.** Апдейт уедет в runtime, которого ещё нет на устройствах, а
  установленные старые версии его не получат — и это правильно: у них нет
  нативных модулей нового билда.
- Обратная сторона того же правила: **версию обязательно поднимать в каждом
  релизе с нативными изменениями**. Если оставить прежнюю, OTA прилетит на
  старый нативный билд и уронит его на первом же экране, который тянет новый
  нативный модуль.
- Версия живёт в двух местах и должна совпадать: `app.config.js` (`version`) и
  `package.json` (`version`).
