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
   Готовый текст — §4.3.
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
    (обязательное поле, текст — §4.1; локализации en/ru заполняются каждая
    в своей языковой вкладке).
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

7. Production → Create new release → release notes на en и ru (текст — §4.2,
   у Play жёсткий лимит 500 символов на язык, поэтому версии короче App Store).
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

## 4. Тексты для магазинов (релиз 26.07.2)

Тексты ниже — под этот конкретный релиз (каталог видов, территории, звуки
xeno-canto, импорт eBird, гостевой режим, новый онбординг). В следующем релизе
их надо переписать, а не копировать.

### 4.1. Release notes, App Store (What's New)

Лимит — 4000 символов на язык, вставляется в свою языковую вкладку версии.

**English**

```
Birds of the world — the full catalogue is now in the app.

• Browse the taxonomy from orders down to species: photos, size, traits and where the bird lives.
• Listen to recordings from xeno-canto right on the species page, with the recordist and licence next to every track.
• Compare two species side by side.
• Countries: checklists with endemics and rare species — and a side-by-side comparison of any two countries.
• Import your eBird life list from the CSV export. Running the same file twice creates no duplicates.
• The catalogue is open without an account — sign up when you want to save your first sighting.
• A new intro sets up your country, your location and your first species in a minute.
• Rare birds near you now have their own card on the home screen.
• Links to species and countries open straight in the app.

Plus the usual: offline fixes, faster syncing and a lighter download.
```

**Русский**

```
Птицы мира — полный каталог теперь в приложении.

• Смотрите классификацию от отрядов до видов: фото, размеры, признаки и места обитания.
• Слушайте записи голосов с xeno-canto прямо на странице вида — с автором и лицензией у каждой записи.
• Сравнивайте два вида друг с другом.
• Страны: чек-листы с эндемиками и редкими видами, а также сравнение любых двух стран.
• Переносите свой лайфлист из eBird — обычным CSV из выгрузки. Повторная загрузка того же файла не создаёт дублей.
• Каталог открыт без регистрации — аккаунт нужен, только когда захотите сохранить своё наблюдение.
• Новый онбординг за минуту настраивает страну, геолокацию и первый вид в лайфлисте.
• Редкие птицы рядом с вами — теперь отдельной карточкой на главном экране.
• Ссылки на виды и страны открываются сразу в приложении.

И по мелочи: исправления офлайн-режима, более быстрая синхронизация и меньший размер загрузки.
```

### 4.2. Release notes, Google Play

Лимит жёсткий — **500 символов на язык**, включая переносы строк; консоль
режет, а не предупреждает. Тексты ниже уже в лимите (en — 430, ru — 416),
при правках пересчитывать.

**English**

```
• Birds of the world: taxonomy, photos, xeno-canto sounds, traits and ranges
• Compare two species — or two countries — side by side
• Country checklists with endemics and rare species
• Import your eBird life list from a CSV export
• Browse the catalogue without an account
• New intro: country, location, first species
• Rare birds near you on the home screen
• Species and country links open in the app
• Offline and sync fixes
```

**Русский**

```
• Птицы мира: классификация, фото, голоса с xeno-canto, признаки и ареалы
• Сравнение двух видов и двух стран
• Чек-листы стран с эндемиками и редкими видами
• Импорт лайфлиста из eBird (CSV)
• Каталог доступен без регистрации
• Новый онбординг: страна, геолокация, первый вид
• Редкие птицы рядом — на главном экране
• Ссылки на виды и страны открываются в приложении
• Исправления офлайна и синхронизации
```

### 4.3. Notes for reviewer (App Store, English)

Одним текстом в поле «Notes» формы App Review Information. Демо-аккаунт —
профиль `9386` (см. §1, шаг 2); подставить его почту в первый абзац.

```
DEMO ACCOUNT
Email: <review account email>  /  Password: <password>
Sign in with "Continue with email" on the welcome screen — Apple and Google
sign-in are alternatives, the account above does not need them.

MOST OF THE APP NEEDS NO ACCOUNT
The species catalogue ("Birds of the world"), species pages with photos and
sounds, country checklists and the compare screens are all open to a guest, so
you can review them without signing in at all. An account is only asked for
when the user saves personal data: their own sightings, life list, diary,
places and rare-bird alerts. That is also why the app does not open with a
sign-up wall.

NEW IN THIS VERSION — WHERE TO LOOK
1. Catalogue: home screen → "Birds of the world" → any order/family → species
   page (photos, measurements, traits, sounds, countries).
2. Compare: species page → "Compare"; countries list → "Compare countries".
3. eBird import: Settings → "Import Data". The user picks a CSV file that they
   themselves exported from their own eBird account; the file is uploaded to
   our server only to match the species names against our taxonomy, and the
   resulting records go into that user's own life list. The "Show imported
   records in the community" switch is OFF by default — nothing is published
   unless the user turns it on. Re-importing the same file creates no
   duplicates.
4. Onboarding: Settings → "Replay onboarding" (this row is visible only to the
   review profile above) replays the intro flow — country, optional location
   permission, first species.

SOUND RECORDINGS
Recordings are streamed from xeno-canto.org and are published there under
Creative Commons licences. Every recording in the app shows its attribution
inline: the recordist's name, a link to the original XC page and a link to the
specific licence. The app records no audio itself.

PERMISSIONS
• Camera and microphone: not used and not requested — photos are picked from
  the library only.
• Location: optional. It is used to show sightings near the user and to send
  rare-bird alerts. If the user denies it, the app works and simply shows
  everything without a distance filter.
• Notifications: optional. Push is only used for rare-bird alerts; radius,
  rarity threshold and quiet hours are configurable in the alert settings.

ACCOUNT DELETION
Settings → "Delete account" removes the account and all its data (observations,
diaries, places, profile) after an email confirmation. No support request or
website visit is needed.

CONTENT
User-generated content is limited to a user's own sightings (species, date,
place and notes) and, if they choose to share them, their
appearance in the community feed. Species descriptions, photos and range data
come from our own curated taxonomy database.
```
