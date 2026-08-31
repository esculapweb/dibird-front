# Публикация релиза в App Store и Google Play

Порядок действий в консолях магазинов. Тестовый гейт — отдельно, в
`RELEASE_CHECKLIST.md`: этот документ начинается там, где тот заканчивается,
и предполагает, что `npm run check`, `npm test` и ручные проверки уже зелёные.

Составлено под релиз **26.08.0** (предыдущий — 26.07.2). Пункты, помеченные
«разово», относятся к тому, что появилось именно в этом релизе — фотографии
наблюдений и вся обвязка модерации (жалобы, блокировки), карта мест, фильтры
в списках, вкладка «Редкости» в ленте, ссылка «Поддержать проект».
Остальное повторяется от релиза к релизу.

**Чем этот релиз отличается от предыдущих.** В приложении появился публичный
пользовательский контент с картинками: фото в наблюдении видны всем, если
наблюдение публичное ([CommunityScreen.tsx](screens/CommunityScreen.tsx)).
Разрешений в билде от этого не прибавилось — фото берутся только из галереи
([ObservationPhotoPicker.tsx](components/Observation/ObservationPhotoPicker.tsx)),
камера и микрофон по-прежнему выключены плагинами в `app.config.js`, — но
анкеты в обеих консолях меняются, и добавляется **Guideline 1.2** у Apple и
**UGC policy** у Google. По ним отказ получают независимо от того, загрузил ли
кто-нибудь что-нибудь запрещённое: проверяют не контент, а наличие механизмов.

## 0. Блокер: правила и политика на проде

**Сделать до сабмита в обе консоли, иначе всё остальное бессмысленно.**
Тексты `terms` и `privacy` обновлены под фотографии и модерацию только
**локально** — см. [MODERATION_PLAN.md](MODERATION_PLAN.md) §4. Ревью обеих
площадок читает `dibird.com/terms/` и `dibird.com/privacy/`, а там сейчас
редакция, в которой фотографий нет вовсе: нет zero-tolerance-формулировки,
которую Apple ждёт по 1.2, нет описания жалоб и блокировок, нет фото в
перечне обрабатываемых данных. Перенести через админку (`api.StaticPageMeta`,
по строке на язык), проверить обе страницы на проде и на en, и на ru.

Даты вступления в силу и `TERMS_VERSION` при переносе не поднимаются —
обоснование там же, в MODERATION_PLAN §4.

## 1. App Store

### До сборки (App Store Connect, можно параллельно с билдом)

1. **App Privacy** — разово: добавить `User Content` → `Photos or Videos`:
   collected, linked to identity, purpose «App Functionality», **не** used for
   tracking. Это отдельная категория, и заведённый в прошлом релизе
   `Other User Content` (импорт eBird) её не покрывает — нужны оба пункта.
   Камера и микрофон по-прежнему должны быть сняты: этих разрешений в билде
   нет (`expo-image-picker` и `expo-audio` с `cameraPermission: false` /
   `microphonePermission: false` в `app.config.js`).
2. **Точную геолокацию из фотографий заявлять не нужно.** Каждый снимок перед
   отправкой пересобирается в JPEG
   ([ObservationPhotoPicker.tsx](components/Observation/ObservationPhotoPicker.tsx#L78-L83)),
   EXIF при перекодировке не переносится, координаты снимка на сервер не
   уезжают. Локация в анкете остаётся ровно та, что была раньше (алерты,
   сортировка мест, карта). Если формулировку в анкете придётся защищать —
   проверить на реальном файле с GPS, а не на слово.
3. **Age Rating** — переотвечать анкету: вопросы про user-generated content и
   про возможность пользователей обмениваться контентом теперь однозначно
   «да» (публичные фото в ленте). Рейтинг, скорее всего, поднимется с 4+ —
   это ожидаемо и не повод искать ошибку в ответах.
4. **Самопроверка по Guideline 1.2 (UGC)** — Apple требует четырёх вещей
   сразу, вот их статус на этот релиз:
   - согласие с правилами и zero tolerance к недопустимому контенту —
     [AuthAgreement.tsx](components/Auth/AuthAgreement.tsx) на Welcome и в
     гейте авторизации + §5–6 terms (**после переноса на прод**, см. §0);
   - механизм жалобы — меню «⋯» у наблюдения в ленте, у профиля и у
     полноэкранного фото ([useModeration.tsx](hooks/useModeration.tsx));
   - блокировка автора — те же меню, снятие в
     [BlockedUsersScreen.tsx](screens/BlockedUsersScreen.tsx);
   - контакты с реакцией за 24 часа — §15 terms.
   **Незакрыт один пункт:** проактивной фильтрации при загрузке нет
   (MODERATION_PLAN §3 — автопроверка облачным классификатором в очереди).
   Реактивной модерации плюс правил обычно хватает, но если прилетит отказ по
   1.2 — почти наверняка сюда.
5. **App Review Information** — демо-аккаунт. Скрытые пункты настроек
   («Replay onboarding») открыты только профилю `9386`
   (`APP_REVIEW_PROFILE_ID` в `screens/SettingsScreen.tsx`) — в форме должен
   стоять именно он, с рабочим паролем.
6. **Notes для ревьюера** — разово, готовый текст в §4.3. Прошлая редакция
   утверждала, что UGC ограничен видом, датой, местом и заметками; оставлять
   её нельзя — это прямая неправда, которую ревьюер увидит на первом же
   экране ленты. В новом тексте есть фото, вся обвязка модерации и точные
   пути, где её нажать.
7. **Донат.** Появилась строка «Поддержать проект» в настройках. Она открывает
   страницу на сайте во внешнем браузере, кошельков и сумм внутри бинарника
   нет — это осознанно, обоснование в
   [util/openDonatePage.ts](util/openDonatePage.ts). Если ревью прицепится к
   3.1.1 — ответ в этом; заводить IAP не нужно.
8. Export compliance трогать не нужно: `ITSAppUsesNonExemptEncryption: false`
   в `app.config.js` → вопрос при сабмите не задаётся.

### Сборка и отправка

9. `npx expo prebuild --clean` локально — `ios/`/`android/` не в репозитории и
   успевают устареть; без этого e2e гоняются против старого манифеста.
10. `eas build -p ios --profile production` — `buildNumber` поднимается сам
    (`autoIncrement` + `appVersionSource: "remote"` в `eas.json`), marketing-
    версия берётся из `app.config.js` (26.08.0, совпадает с `package.json`).
11. `eas submit -p ios --profile production` — `appleId` и `ascAppId` уже
    прописаны в `eas.json`.
12. **TestFlight перед сабмитом, обязательно поверх версии из стора.** В
    релизе две новые миграции SQLite (`drizzle/0015` — кэш мест, `drizzle/0016`
    — таблица `observation_photo`), и проверять надо именно апгрейд: старые
    наблюдения на месте, очередь синка цела, к старому наблюдению добавляется
    фото. Отдельно — сценарий «добавил фото в офлайне»: файлы лежат в
    `documentDirectory` и уходят при появлении сети, это самый новый код в
    релизе.

### Версия и ревью

13. `+ Version` → номер из `app.config.js` (26.08.0) → заполнить **What's New**
    (обязательное поле, текст — §4.1; локализации en/ru заполняются каждая
    в своей языковой вкладке).
14. Разово: обновить скриншоты под фото в наблюдениях, ленту и карту мест.
    **На скриншотах не должно быть чужих фотографий из ленты** — только свои
    или заведомо очищенные права.
15. Прикрепить обработанный билд, ответить на вопрос об IDFA (нет), Submit for
    Review.

## 2. Google Play

### До сборки (Play Console)

1. **Data safety** — разово: добавить `Photos and videos` → `Photos`:
   collected, transferred off device, **optional**, purpose «App
   functionality», encrypted in transit, deletion available (в приложении есть
   удаление аккаунта). `Shared` **не** ставить: показ фотографии другим
   пользователям внутри приложения — не передача третьей стороне в
   терминологии Google. Заодно проверить, что на месте прошлые пункты
   (`Files and docs` за импорт eBird, локация, фото аватара) и что аудио с
   камерой по-прежнему сняты.
2. **Photo and Video Permissions declaration — скорее всего не нужна.** Она
   требуется только при `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` в манифесте, а
   `expo-image-picker` ходит через системный Photo Picker. Проверить **после**
   `npx expo prebuild --clean`, а не по лежащей в рабочей копии `android/` —
   она устаревает молча:

   ```
   grep uses-permission android/app/src/main/AndroidManifest.xml
   ```

   Ожидаемо: `READ_EXTERNAL_STORAGE` c `maxSdkVersion="32"` и без
   `READ_MEDIA_*`. Если `READ_MEDIA_IMAGES` всё-таки появился — декларацию
   заполнять придётся, и в ней объяснять, почему системного пикера
   недостаточно.
3. **Content rating (IARC)** — переотвечать анкету: пользователи могут
   обмениваться контентом и изображениями, есть взаимодействие между
   пользователями, есть обмен геолокацией. Рейтинг может измениться.
4. **App content → Child safety standards.** Декларация (публичная
   CSAE-политика, точка контакта, in-app reporting) обязательна для
   приложений категорий Social и Dating. DiBird в этих категориях числиться
   не должен — **проверить фактическую категорию в консоли**: если там стоит
   Social, без заполненной декларации и опубликованной политики релиз не
   уедет.
5. **App content → Permissions**: декларировать нечего — `RECORD_AUDIO` и
   foreground service из манифеста ушли ещё в прошлом релизе. Если декларация
   подавалась раньше, свериться, что она не противоречит новому манифесту.
6. Проверить, что **SHA-256 из App Signing** не менялся: от него зависит
   верификация App Links. Файл на сайте —
   `https://dibird.com/.well-known/assetlinks.json`.

### Сборка и отправка

7. `eas build -p android --profile production` → AAB (`buildType:
   "app-bundle"`), `versionCode` инкрементится удалённо.
8. `eas submit -p android --profile production`. Внимание:
   `serviceAccountKeyPath` в `eas.json` **закомментирован** — submit попросит
   учётные данные интерактивно, либо AAB грузится в консоль руками.
9. Сначала **Internal testing**, а не сразу production: это единственный
   способ получить Pre-launch report, а он важен из-за R8 (minify + shrink) и
   `targetSdk 36`. В этом релизе к нему добавился повод посерьёзнее: выбор
   фотографий идёт через системный пикер, а это ровно тот код, который
   ломается от версии Android и от вендорских оболочек.

### Раскатка

10. Production → Create new release → release notes на en и ru (текст — §4.2,
    у Play жёсткий лимит 500 символов на язык, поэтому версии короче App
    Store).
11. **Staged rollout 10–20 %**, не 100 %: в релизе две новые миграции SQLite
    (`drizzle/0015`, `0016`) и первая в истории приложения загрузка файлов —
    откатить раскатку дешевле, чем выпускать новый билд.
12. После раскатки — Sentry/Crashlytics за первые часы и отдельно очередь
    жалоб в админке: письмо на `ADMINS` уходит на каждую, и первые сутки после
    появления фото в сторе стоит смотреть на неё чаще обычного.

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

### Уведомление о выпуске (бэдж на колокольчике)

Приложение само сообщает бэкенду, на каком выпуске оно работает
([hooks/useAppUpdateNotifications.ts](hooks/useAppUpdateNotifications.ts)), а
тот в ответ кладёт уведомление в ленту — **без пуша**, только бэдж. Молчание
по умолчанию: пока в админке нет записи о выпуске, ничего не появляется, и
багфиксные OTA доезжают незаметно.

Чтобы о выпуске сказали, в админке (`myapi → App releases`) заводится запись:

- `kind` — `ota` или `build`;
- `App release revisions` — **обе строки**: `eas update` печатает отдельный
  update id на каждую платформу («Android update ID» и «iOS update ID»), и
  телефон присылает именно свой. Group id приложению не виден, его вставлять
  бесполезно. Завести только один id — значит оставить без уведомления всю
  вторую платформу. Для магазинного билда сюда идёт `nativeBuildVersion` (то,
  что видно в `getFullVersion()` в скобках), у iOS и Android он тоже свой;
- `runtime_version` — маркетинговая версия из `app.config.js`;
- `platform` — `all`, если выпуск общий;
- `notify` — снять, чтобы выпуск проехал молча;
- внутри записи — по строке `App release note` на каждый язык (`en`, `ru`):
  заголовок и текст пунктами. Лимит текста — 512 символов, ровно как у
  уведомления, куда он уезжает.

Что увидит человек:

1. **OTA скачан** — «Обновление готово», тап применяет его сразу
   (`Updates.reloadAsync`). Текст этого уведомления зашит в коде
   (`myapi/services/app_release.py`), заводить его на каждый релиз не нужно;
   уведомление появляется только если запись о выпуске уже есть — см. про
   окно ниже.
2. **OTA применён / поставился новый билд** — «что нового» теми пунктами, что
   заведены в `App release note`. Первое уведомление при этом гасится само.

Запись заводится **после** публикации — раньше неоткуда взять update id, его
печатает сам `eas update`. Для «что нового» это ничего не стоит: пока записи
нет, бэкенд отвечает 204, а приложение переспрашивает на каждом старте **в
течение недели** с первого вопроса, так что уведомление догонит и тех, кто
обновился раньше, чем написали текст. После недели молчание считается
окончательным (иначе выпуск без записи — а это большинство багфиксов —
спрашивал бы вечно).

**А вот «Обновление готово» так не догоняет, и это принятый компромисс.**
Стадия `pending` живёт только пока апдейт скачан, но не применён: ближайший
холодный старт применяет его, и переспрашивать становится не о чем. Между
`eas update` и заведением записи проходят минуты, и все, кто скачал апдейт в
это окно, получат только «что нового» — без предложения перезапуститься.
Ничего страшного с ними не случится: обновление применится само на следующем
запуске, ровно как до появления всей этой механики. Закрыть окно полностью
можно было бы, заводя выпуск до публикации (id привязывался бы к нему первым
пришедшим устройством) или публикуя через rollout, — сознательно не делаем:
цена в сложности релиза выше, чем польза от одного уведомления для части
аудитории.

На свежей установке «что нового» не показывается: сравнивать не с чем.

Уведомления живут на профиле, поэтому гостей они не касаются вовсе.

Если уведомлений нет, а выпуск заведён — смотреть логи `web` на проде по
строке `app-update:`. Там видно каждый разбор: `no release for kind=… revision=…`
(id не тот или не заведён), `has no notes yet` (нет `App release note` на
нужном языке), `is not for ios` (выпуск помечен другой платформой) и
`notified profile=…` при успехе. Молчание следов в базе не оставляет, лог —
единственный способ отличить «не завели» от «запрос не дошёл».

## 4. Тексты для магазинов (релиз 26.08.0)

Тексты ниже — под этот конкретный релиз (фото наблюдений, жалобы и
блокировки, карта мест, фильтры, «Редкости» в ленте). В следующем релизе их
надо переписать, а не копировать.

### 4.1. Release notes, App Store (What's New)

Лимит — 4000 символов на язык, вставляется в свою языковую вкладку версии.

**English**

```
Photos — your sightings finally look like what you saw.

• Add up to 5 photos to any sighting, straight from your gallery. Added them offline? They upload themselves once you are back online.
• The community feed shows them too, next to the reference photo of the species.
• New "Rare" tab in the feed: the unusual finds, without scrolling past everything else.
• Report and block: every photo, sighting and profile has it in the ⋯ menu. Reported content disappears from your feed immediately, and blocked users are listed in Settings so you can undo it.
• Your places on a map — clustered, with a legend that explains the sizes, and a tap to open any of them.
• New filters in the lists: with or without photos, public or private, imported from eBird or added here, and by distance.
• Favourite places.
• If the system is blocking notifications, the home screen now says so instead of leaving you to wonder why the rare-bird alerts went quiet.

Plus the usual: offline fixes, faster syncing and a lighter download.
```

**Русский**

```
Фотографии — теперь наблюдение выглядит как то, что вы видели.

• До 5 фото к любому наблюдению, прямо из галереи. Добавили в офлайне — загрузятся сами, когда появится сеть.
• В ленте сообщества они тоже видны, рядом со справочным фото вида.
• Новая вкладка «Редкости» в ленте: необычные находки без пролистывания всего остального.
• Жалоба и блокировка — в меню ⋯ у фото, наблюдения и профиля. То, на что пожаловались, пропадает из вашей ленты сразу, а заблокированные собраны в настройках отдельным списком — разблокировать можно там же.
• Ваши места на карте: кластерами, с легендой размеров и переходом в любое из них по нажатию.
• Новые фильтры в списках: с фото и без, публичные и приватные, перенесённые из eBird и добавленные здесь, по расстоянию.
• Избранные места.
• Если уведомления блокирует система, главный экран теперь об этом говорит — а не оставляет гадать, почему замолчали алерты о редких птицах.

И по мелочи: исправления офлайн-режима, более быстрая синхронизация и меньший размер загрузки.
```

### 4.2. Release notes, Google Play

Лимит жёсткий — **500 символов на язык**, включая переносы строк; консоль
режет, а не предупреждает. Тексты ниже уже в лимите (en — 437, ru — 433),
при правках пересчитывать.

**English**

```
• Photos in your sightings — up to 5, from your gallery. Added offline, they upload when you are back
• The community feed shows them, plus a new "Rare" tab
• Report or block from the ⋯ menu on any photo, sighting or profile; blocked users are listed in Settings
• Your places on a map, with clusters and a size legend
• New filters: with or without photos, public or private, source, distance
• Favourite places
• Offline and sync fixes
```

**Русский**

```
• Фото в наблюдениях — до 5, из галереи. Добавили в офлайне — загрузятся, когда будет сеть
• В ленте сообщества они тоже видны, плюс вкладка «Редкости»
• Жалоба и блокировка — в меню ⋯ у фото, наблюдения и профиля; заблокированные собраны в настройках
• Ваши места на карте: кластеры и легенда размеров
• Новые фильтры: с фото и без, публичные и приватные, источник, расстояние
• Избранные места
• Исправления офлайна и синхронизации
```

### 4.3. Notes for reviewer (App Store, English)

Одним текстом в поле «Notes» формы App Review Information. Демо-аккаунт —
профиль `9386` (см. §1, шаг 5); подставить его почту в первый абзац. Раздел
про UGC и модерацию — прямой ответ на Guideline 1.2, его лучше не сокращать.

```
DEMO ACCOUNT
Email: <review account email>  /  Password: <password>
Sign in with "Continue with email" on the welcome screen — Apple and Google
sign-in are alternatives, the account above does not need them.

MOST OF THE APP NEEDS NO ACCOUNT
The species catalogue ("Birds of the world"), species pages with photos and
sounds, country checklists and the compare screens are all open to a guest. An
account is only asked for when the user saves personal data: their own
sightings, life list, diary, places and rare-bird alerts. That is why the app
does not open with a sign-up wall.

NEW IN THIS VERSION — USER PHOTOS
A user can attach up to 5 photos to their own sighting (New sighting → Photos
→ Add photo). Photos are picked from the photo library only; the app never
opens the camera. If the sighting is public, its photos appear in the
Community feed and are visible to everyone, including guests. Non-public
sightings and their photos are visible to their author only.

USER-GENERATED CONTENT AND MODERATION (Guideline 1.2)
• Terms: every account agrees to the Terms of Service and Privacy Policy
  before it is created — the links are on the welcome screen and in the
  sign-in sheet. The Terms state a zero-tolerance rule for objectionable
  content (pornography, violence, and immediate removal plus a permanent ban
  and a report to the authorities for sexual exploitation of minors).
• Reporting: the ⋯ menu in the header of a feed card ("Report sighting"), of a
  user profile ("Report user"), and in the full-screen photo viewer ("Report
  photo"). A reason is asked for; "Something else" requires a written
  explanation. Reported content disappears from the reporter's feed
  immediately, before any moderator sees it.
• Auto-hide: three reports from different users hide a photo or a sighting
  from everyone until a moderator decides.
• Blocking: "Block author" in the same ⋯ menus. A blocked user's sightings
  disappear from the blocker's feed. The list of blocked users, with
  unblocking, is in Settings → Blocked users.
• Contact and response time: every report also sends an email to the
  moderation team, and the Terms commit to acting within 24 hours. Contacts
  are published in section 15 of the Terms.

PERMISSIONS
• Camera and microphone: not used and not requested. Photos are picked from
  the library only, and the camera permission is blocked at build level.
• Photo library: only to attach photos to a sighting and to set an avatar.
  Photos are resized and re-encoded on the device before upload, so their EXIF
  metadata, including GPS coordinates, is not sent to our servers.
• Location: optional. It is used to show sightings near the user and to send
  rare-bird alerts. If the user denies it, the app works and simply shows
  everything without a distance filter.
• Notifications: optional. Push is only used for rare-bird alerts; radius,
  rarity threshold and quiet hours are configurable in the alert settings.

EBIRD IMPORT (unchanged since the previous version)
Settings → "Import Data". The user picks a CSV file they exported from their
own eBird account; the file is uploaded to our server only to match species
names against our taxonomy. The "Show imported records in the community"
switch is OFF by default. Re-importing the same file creates no duplicates.

SOUND RECORDINGS (unchanged)
Recordings are streamed from xeno-canto.org under Creative Commons licences.
Every recording shows the recordist's name, a link to the original XC page and
a link to the licence. The app records no audio itself.

DONATIONS
Settings → "Support the project" opens a page on our website in the browser.
The app itself neither collects payments nor displays payment details, and
nothing in the app is unlocked by donating.

ACCOUNT DELETION
Settings → "Delete account" removes the account and all its data — sightings,
photos, diaries, places, profile — after an email confirmation. No support
request or website visit is needed.
```
