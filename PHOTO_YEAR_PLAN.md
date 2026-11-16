# Фотогод — рейтинг по числу сфотографированных видов → [Notion #75](https://app.notion.com/p/3355501934238099b4b4edb472c22cf7)

> Живой документ. Создан 2026-11-16. Статус задачи — в Notion, здесь — «как и почему».

## Контекст

Пользователи уже прикладывают фото к наблюдениям (`ObservationPhoto`, до 5 шт.,
офлайн-очередь, модерация — см. [MODERATION_PLAN.md](MODERATION_PLAN.md)).
Нужен отдельный рейтинг: сколько видов человек **сфотографировал** за период
(год/территория). И к нему то, ради чего фотографы вообще ведут такой счёт, —
собственная фотоколлекция видов.

### Как у конкурентов и где у них дыры

| | Что есть | Слабые места |
|---|---|---|
| **Birda** (Global Photo Big Year, фото-челленджи) | Лидерборд «виды с фото», челленджи на месяц/год, бейджи | Не проверяются ни дата, ни вид: подходит любой старый снимок; фото — просто вложение, коллекции нет |
| **eBird / Macaulay** | Фото привязано к виду в чек-листе, крупнейшая медиатека | Рейтинга по фото-видам нет (Top 100 — только по увиденным); в Macaulay считают загрузки, а не виды |
| **iNaturalist** | Вид подтверждает сообщество (Research Grade), лидерборды проектов по видам | Не про птиц и не про год; подтверждение медленное; лидерборд проекта настраивается вручную |
| **Рунет-галереи и форумы** (birds.kz и подобные) | Рейтинг авторов по видам, проверка экспертами | Только веб, ручная модерация, никакой связи с наблюдениями |

### Чем лучше мы

1. **Ноль лишних действий.** Фото — часть наблюдения, которое человек и так
   создаёт. Отдельной загрузки нет, офлайн работает сразу (готовая очередь фото).
2. **Честный счёт, понятный автору.** Дата съёмки из EXIF сверяется с датой
   наблюдения, дубликаты отсекаются по перцептивному хешу, есть жалоба «не тот
   вид». Главное — автор **видит, почему фото не засчитано** («снято в 2019»,
   «такое фото уже есть у другого пользователя»), а не молча теряет очки.
3. **Коллекция вместо голой цифры.** Сетка «вид → лучший кадр» за год или за всё
   время — личная награда, которой можно делиться.
4. **«Видел, но не снял».** Виды из своих наблюдений периода без засчитанного
   фото — готовая цель на следующий выезд. У конкурентов этого нет.
5. Те же фильтры, что в обычном рейтинге (год, территория), и тот же честный
   тай-брейк «кто раньше набрал».

## Решения

- **Дата.** Вид засчитывается по дате наблюдения в периоде. Если у фото есть
  EXIF `DateTimeOriginal` и он расходится с датой наблюдения больше чем на 3 дня,
  фото не засчитывается. Нет EXIF (скриншот, пересланное из мессенджера) —
  засчитывается с пометкой «без даты съёмки»: строгий режим отсёк бы
  добросовестных.
- **Приватность.** Фото из `private`-наблюдений засчитываются (как в обычном
  рейтинге — фильтр по `profile__private`, а не по `private` наблюдения), но в
  чужой коллекции на их месте плейсхолдер «фото скрыто».
- **Модерация.** Фоторейтинг учитывает `moderation_status`: скрытое фото — не
  очко. **Обычный рейтинг `moderation_status` не учитывает и не будет** (решение
  пользователя 2026-11-16) — не поднимать снова.
- **Объём MVP:** рейтинг, коллекция, «видел, но не снял», жалоба «не тот вид»,
  статус засчитанности для автора. Остальное — фаза 2.

## Что засчитывается (единое правило, бэк)

Фото **засчитывается** (eligible), если выполнено всё:

- `moderation_status = ok` у фото и у наблюдения;
- `observation.species.active = True`;
- `taken_at IS NULL` или `|taken_at − observation.date_time| ≤ 3 дня` — в ORM
  через `F("observation__date_time") ± timedelta`, без денормализации: правка
  даты наблюдения пересчитывается сама;
- нет более раннего фото с тем же `phash` у **другого** профиля;
- `rating_excluded = False` (ставит модератор или автоматика по жалобам «не тот вид»).

Правило живёт в одном месте — `myapi/services/photo_rating.py`,
`eligible_photos()`. Им пользуются рейтинг, коллекция и статус для автора.

## Бэкенд (`/Users/esculapweb/Py/dibird`)

1. **`ObservationPhoto`**: поля `taken_at` (DateTimeField, null), `phash`
   (CharField(16), null, db_index), `rating_excluded` (bool, default False).
2. **Загрузка** (`ObservationPhotoCreateSerializer`): необязательное `taken_at`,
   валидация (не в будущем, не раньше 1990). `phash` — рядом с
   `build_photo_thumbnail`, `imagehash.dhash` поверх Pillow (новая зависимость
   `imagehash`; проверить numpy в образе). Дубликаты в MVP — только точное
   совпадение хеша.
3. **`myapi/services/photo_rating.py`**: `eligible_photos(qs)`,
   `photo_status(photo) → counted | date_mismatch | duplicate | disputed | hidden`.
4. **`GET myapi/photo-rating/`** — по образцу `Rating`: `Observation` с
   `Exists(eligible_photos)`, `seen_qty = Count(species_id, distinct)`.
   Переиспользовать `filter_by_territory_and_period`, `RatingFilterSet`,
   `RatingSerializer`. `species_count_reached_at` обобщить параметром «колонка
   момента», чтобы тай-брейк шёл по `ObservationPhoto.created_at`.
5. **`GET myapi/photo-collection/?profile=&territory=&date_time_min/max=`** — по
   строке на вид: `species_data`, лучший кадр (в MVP — первое засчитанное по
   `sort_order` самого раннего наблюдения), `photos_count`, `date`, `hidden`
   (для чужих приватных — без ссылок на файл). Шапка — `count` и `rank`.
6. **`GET myapi/photo-collection/missing/`** (только свой профиль): виды из
   наблюдений периода без засчитанного фото, по убыванию числа встреч.
7. **`rating_status`** в `ObservationPhotoSerializer` — только владельцу.
8. **Жалоба «не тот вид»**: `ContentReport.reason = wrong_species`, только для
   фото. `handle_new_report`: 3 такие жалобы → `rating_excluded=True` (фото
   остаётся видимым, теряет только очки). В `ObservationPhotoAdmin` — фильтр и
   действия «не засчитывать» / «засчитать».
9. **Тесты** рядом с `test_rating_api.py`: все ветки eligibility, тай-брейк,
   приватность в коллекции, missing, жалоба → исключение, валидация `taken_at`.

## Клиент

1. **EXIF до сжатия.** [ObservationPhotoPicker.tsx](components/Observation/ObservationPhotoPicker.tsx):
   `exif: true` у `launchImageLibraryAsync`, дата берётся до `manipulateAsync`.
   Утилита `util/exifDate.ts`: `DateTimeOriginal` (`"YYYY:MM:DD HH:MM:SS"`) +
   `OffsetTimeOriginal`, если есть. Сжатие по-прежнему срезает EXIF/GPS —
   приватность из [STORE_RELEASE_STEPS.md](STORE_RELEASE_STEPS.md) не меняется.
   Нативных изменений нет — `exif` это JS-опция.
2. **Очередь фото**: колонка `takenAt` в `observationPhotoTable` + drizzle-миграция;
   проброс через `observationPhotoRepository.queueUploads` и
   `uploadObservationPhoto` (multipart-поле `taken_at`). Тип `ObservationPhoto`:
   `taken_at?`, `rating_status?`.
3. **Экран `PhotoRating`** — по образцу [RatingScreen.tsx](screens/RatingScreen.tsx):
   `ListScreen` + `RatingCard`, `fetchPhotoRating` через `fetchAbstract`, фильтры
   `territory` + `date` (дефолт `this_year`), сорт-кейс в
   `util/sortOptionsList.ts`. Тап по строке — коллекция пользователя.
4. **Экран `PhotoCollection` `{ profileId }`**: шапка (N видов, место, фильтры),
   сетка на `expo-image`, тап → [PhotoViewerModal.tsx](components/ui/PhotoViewerModal.tsx).
   У своего профиля — сегмент «Сняты / Видел, но не снял».
5. **Точки входа**: плитка в [Sections.tsx](components/Main/Sections.tsx),
   переключатель «Наблюдения | Фото» в шапке `RatingScreen`, «Моя фотоколлекция»
   из профиля/статистики.
6. **Статус фото у автора** — метка на миниатюре в
   [ObservationPhotos.tsx](components/Observation/ObservationPhotos.tsx), если
   `rating_status ≠ counted`.
7. **Жалоба**: `wrong_species` в `REASONS_BY_TARGET.photo`
   ([hooks/useModeration.tsx](hooks/useModeration.tsx)).
8. **Инвалидация** (`util/invalidationMap.ts`): `PhotoRating`, `PhotoCollection`,
   `PhotoCollectionMissing` — на изменения наблюдений и на загрузку/удаление
   фото в `services/sync/observationPhotoSync.ts`.
9. **i18n**: en + ru в паре, счётчик видов — с плюральными формами, статусы фото —
   динамические ключи с перечислением `// t("photo_status_…")` внизу файла.
10. **Аналитика**: `photo_rating_viewed`, `photo_collection_viewed`.

## Фаза 2 (после MVP, карточки — по согласию)

Сравнение двух фотографов (по образцу `RatingsCompare`), ачивки за пороги
10/50/100/250 видов, пуш «вас обогнали в фотогоде», карточка итогов года для
шеринга, веб-страница и диплинк, ручной выбор обложки вида, подсказка «взять дату
наблюдения из фото», нечёткие дубликаты (расстояние Хэмминга), фото
пользователей в карточке вида каталога.

## Проверка

- Бэк: `docker compose exec web python manage.py test myapi.tests.test_photo_rating myapi.tests.test_rating_api myapi.tests.test_moderation`
  из `docker/dibird_local`.
- Клиент: `npm run check`, `npm test` (тесты `exifDate`, репозиторий фото с
  `takenAt`, хук/экран коллекции на реальном `QueryClient`).
- Вручную: фото с EXIF этого года → вид в рейтинге; EXIF 2019 → метка «не
  засчитано»; без EXIF → засчитано с пометкой; приватное наблюдение → в своей
  коллекции видно, в чужой — плейсхолдер; офлайн-добавление → после синка
  рейтинг обновился.
- e2e: `npm run e2e:lint` после новых `testID`; флоу — в очередь
  [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §6.
