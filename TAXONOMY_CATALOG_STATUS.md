# Статус: страницы веба, которых не было в приложении

Отслеживает выполнение роадмапа из `/Users/esculapweb/.claude/plans/crispy-meandering-chipmunk.md`
(сравнение веб-версии Dibird с RN-приложением). Обновляется по ходу работы.

## Приоритет 1 — Каталог видов / таксономия (Order → Family → Genus → Species)

**Статус: готово, кроме тестов на часть новых экранов.**

Сделано:
- `types.ts` — типы таксономии (`TaxonRank`, `TaxonListItem`, `TaxonGroupDetail`,
  `TaxonSpeciesDetail` и др.), обновлён `AppStackParamList`: добавлены роуты
  `Taxonomy`, `TaxonGroupDetail`; `SpeciesDetail` теперь принимает `{segment}`
  или `{id}` (было только `{id}`)
- `services/db/schema.ts` + миграция `drizzle/0013_mysterious_hercules.sql` —
  офлайн-кэш таксонов (`taxon_list_cache`, `taxon_detail_cache`)
- `util/fetches.ts` — `fetchTaxonList`, `fetchTaxonDetail`, `fetchTaxonSegmentById`
- `screens/SpeciesDetailScreen.tsx` — **переписан с нуля** (был текстовой
  заглушкой `<Text>SpeciesDetailScreen</Text>`). Показывает фото, статус,
  латинское название и автора, описание, ареал гнездования, страны обитания,
  подвиды, похожие виды, prev/next пагинацию. Поддерживает как переход по
  `segment` (из приложения), так и по `id` (из push-уведомлений, через
  резолв id→segment)
- `screens/TaxonomyScreen.tsx` — список любого ранга (Order/Family/Genus/Species),
  поиск по названию, ссылка на вымерших видов с корневого экрана (Orders)
- `screens/TaxonGroupDetailScreen.tsx` — детальная страница Order/Family/Genus:
  хлебные крошки, описание, список дочерних таксонов
- `components/Taxonomy/TaxonRow.tsx`, `components/Taxonomy/TaxonChildrenList.tsx`
  — переиспользуемые список/строка (не завязаны на `Filters`/`ListScreen`,
  т.к. территория/дата/вид там неприменимы)
- Список вымерших видов — отдельного экрана не делали, это тот же
  `TaxonomyScreen` с `rank: 5, extinct: true` (переиспользует существующий API-фильтр
  `extinct` вместо отдельного tree-эндпоинта `/api/extinct/`)
- Точка входа: плитка «Каталог видов» на главном экране
  (`components/Main/Sections.tsx`)
- **Побочный, но важный фикс:** `util/helpers.ts:speciesDetails()` раньше
  просто открывал веб-страницу вида в браузере (`Linking.openURL`) — это был
  обходной путь из-за отсутствующего экрана. Теперь ведёт на
  `SpeciesDetailScreen` внутри приложения. Это сразу чинит переходы «о виде»
  в 7 местах: `ObservationDetailScreen`, `CommunityDetailScreen`, `StatScreen`,
  `RatingsCompareScreen`, `UserStatScreen`, `SpeciesDropdown`, `BirdOfTheDay`
- Ключи локализации добавлены в `locales/ru.json` и `locales/en.json`
- `screens/__tests__/SpeciesDetailScreen.test.tsx` — 10 тестов (загрузка,
  ошибки, редирект, резолв id→segment, рендер данных, навигация)

Дополнено после первого прохода по реальным данным (скриншоты с устройства):
- Хлебные крошки получили разделитель `/` (сливались визуально) — вынесены
  в общий `components/Taxonomy/TaxonBreadcrumbs.tsx`, используется на
  `TaxonGroupDetailScreen` и `SpeciesDetailScreen`
- Список стран на `SpeciesDetailScreen` сгруппирован по региону
  (`TaxonCountry.region`, новое поле — backend `get_countries` в
  `serializers.py` добавляет его через `Subquery` на `RegionMultilang`)
- Синонимы (`multilangs.synonyms`) и научные синонимы/протонимы
  (`multilangs.protonyms`) теперь отображаются; переводы названий на другие
  языки (`multilangs.langs`, обычно 50-70+ языков) — в свёрнутом по
  умолчанию блоке со счётчиком
- Голоса (`sounds`) реализованы: `expo-audio` добавлен в зависимости и в
  `app.config.js` (plugins), `components/Taxonomy/TaxonSoundRow.tsx` — играет
  один звук за раз. **Требует пересборки нативного клиента**
  (`expo prebuild`/`expo run:ios`/`run:android` или EAS build) — это новый
  нативный модуль, JS-перезагрузки недостаточно
- Попутно найдены и починены баги на бэкенде (`app/api/serializers.py`):
  `get_photos`/`get_sounds` возвращали относительные `/media/...` пути без
  `request.build_absolute_uri`, `SpeciesListSerializer.thumb` был `ImageField`
  поверх сырой строки из `.values()` (всегда `None`), `count` — это словарь
  готовых локализованных строк по рангу потомков, а не число

Не сделано:
- [ ] Тесты для `TaxonomyScreen`, `TaxonGroupDetailScreen`,
      `TaxonChildrenList`, `TaxonRow` — новые файлы без покрытия, остальной
      проект тестирует каждый экран/компонент

Проверка: `npx tsc --noEmit` чистый, `npx jest` — все 164 набора (1773 теста)
проходят на момент последнего прогона.

## Приоритет 2 — Территории (список / детали / сравнение регионов)

**Статус: не начато.**

- [ ] `TerritoryListScreen` — список стран/территорий
- [ ] `TerritoryDetailScreen` — виды по территории + статистика
- [ ] `TerritoryCompareScreen` — сравнение видового состава двух территорий
      (не путать с `RatingsCompareScreen` — тот сравнивает пользователей)
- API уже готов: `territory`, `territory-list`, `territory-species`,
  `territory-compare` (`/api/...`) — работа чисто фронтовая, по той же схеме,
  что и таксономия (тип-слой + fetch-функции + cache-таблицы + экраны)

## Приоритет 3 — возможно, позже (глобальный поиск, новости)

**Статус: не начато**, не в приоритете по решению пользователя.

- [ ] Глобальный поиск (`/api/search/` уже есть) — экран результатов + точка входа
- [ ] Новости (`/api/news/` уже есть) — `NewsScreen` + `NewsDetailScreen`

## Не переносится в приложение (решение пользователя)

Чек-лист (Checklist), статические страницы (about/help/cookie-policy/
data-deletion/donate/android-beta), Contact, Status, Hire, Offline page —
в роадмап не входят, изменений не было.
