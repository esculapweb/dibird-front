import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import DropdownInput from "../ui/DropdownInput";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import { BirdSVG } from "../ui/Svgs";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useLanguage } from "../../store/language-context";
import { useFilters } from "../../store/filters-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { fetchCommunityObservations, fetchSpecies } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { Config } from "../../constants/config";
import {
  ObservationItem,
  PaginatedResponse,
  SpeciesDropdownItem,
} from "../../types";

const CARD_IMAGE = 56;
/** Сколько уникальных видов показываем плиткой. */
const MAX_CARDS = 9;
/**
 * Ниже этого порога плитка не собирается и шаг сразу показывает поиск: две
 * карточки на месте обещанного «выберите из списка» выглядят поломкой, а не
 * подсказкой. Такое бывает в странах, где сообщества у приложения ещё нет.
 */
const MIN_CARDS = 3;
/** Наблюдений на запрос: их приходится брать с запасом — виды повторяются. */
const PER_PAGE = 40;

/**
 * Первый успех: тап по птице создаёт наблюдение и лайфлист перестаёт быть
 * пустым. Список — кого реально отмечали в этой стране последними
 * (`fetchCommunityObservations`, тот же вызов, что в `RareNearby`, только без
 * радиуса и настроек алертов). Данных о частоте видов в регионе на бэке нет,
 * а обычные птицы всплывают в таком списке сами.
 */
const OnboardingSpeciesStep = ({
  territory,
  onPick,
  isCreating,
  onLoadError,
}: {
  territory: number | null;
  onPick: (species: SpeciesDropdownItem) => void;
  isCreating: boolean;
  /**
   * Оба списка живут только в сети, а у нового аккаунта кэша ещё нет. Экран
   * обязан узнать о провале: до созданной записи кнопки «Далее» на шаге нет, и
   * без этого единственным выходом остаётся «Пропустить» — отказ сети попадал
   * бы в `onboarding_skipped` наравне с отказом человека.
   */
  onLoadError?: (failed: boolean) => void;
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { language } = useLanguage();
  const { date } = useFilters();

  const { data, isLoading, isError } = useQuery<
    PaginatedResponse<ObservationItem>
  >({
    // Язык в ключе: сервер локализует названия видов, а staleTime здесь
    // длинный — без него смена языка отдала бы прошлую версию.
    queryKey: ["OnboardingNearbySpecies", territory, language],
    queryFn: () =>
      fetchCommunityObservations(
        { territory },
        "-date_time",
        "",
        1,
        null,
        PER_PAGE,
      ),
    enabled: !!territory,
    staleTime: StaleTime.ONE_HOUR,
  });

  const cards = useMemo(() => {
    const seen = new Set<number>();
    const result: SpeciesDropdownItem[] = [];

    for (const item of data?.results ?? []) {
      const species = item.species_data;
      if (!species || seen.has(species.id)) continue;
      seen.add(species.id);
      result.push({
        value: species.id,
        label: species.name_lang || species.name,
        name: species.name,
        name_lang: species.name_lang,
        thumb: species.thumb ?? undefined,
        segment: species.segment,
      });
      if (result.length >= MAX_CARDS) break;
    }

    return result;
  }, [data]);

  // Полный список видов страны — и фолбэк вместо плитки, и «выбрать другой
  // вид» рядом с ней. Грузится только когда территория уже выбрана.
  //
  // `date` здесь не для фильтрации, а ради общего кэша с редактором
  // (`ObservationForm`): форма ключа и аргументы `fetchSpecies` обязаны
  // совпадать с тамошними, иначе новичок скачивает 2500 видов дважды — на этом
  // шаге и при первом открытии редактора. Набор опций от даты не зависит
  // (`Stat2ViewSet` строит список из чек-листа территории, дата задевает только
  // аннотацию `seen`), а `seen` у нового аккаунта всё равно нулевой, так что
  // скоуп «этот год» из глобальных фильтров здесь ничего не меняет.
  const { query: speciesQuery, sort, onSortChange } = useDropdownQuery<SpeciesDropdownItem>({
    type: "SpeciesDropdown",
    queryFn: (order) => fetchSpecies(territory, order, date),
    params: [territory, language, date],
    enabled: !!territory && date !== undefined,
  });

  const handleSearchPick = (value: number | null) => {
    const found = speciesQuery.data?.find((item) => item.value === value);
    if (found) onPick(found);
  };

  const showCards = cards.length >= MIN_CARDS;
  // Плитка — не обязательный источник: если её нет, но поиск по стране жив,
  // шаг работоспособен. Тупик наступает, только когда упали оба запроса.
  const loadFailed = isError && speciesQuery.isError;

  useEffect(() => {
    onLoadError?.(loadFailed);
  }, [loadFailed]);

  if (loadFailed)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("onboarding_species_title")}</Text>
        <Text style={styles.text} testID="onboarding-species-error">
          {t("onboarding_species_error")}
        </Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("onboarding_species_title")}</Text>
      <Text style={styles.text}>
        {showCards
          ? t("onboarding_species_text")
          : t("onboarding_species_text_search")}
      </Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={Colors.main100}
          style={styles.loader}
        />
      ) : showCards ? (
        <View style={styles.grid}>
          {cards.map((species) => (
            <TouchableOpacity
              key={species.value}
              style={styles.card}
              activeOpacity={0.8}
              // Пока создаётся запись, соседние карточки заблокированы: два
              // тапа подряд завели бы два наблюдения, а шаг после первого
              // всё равно уходит на экран успеха.
              disabled={isCreating}
              onPress={() => onPick(species)}
              testID={`onboarding-species-${species.value}`}
            >
              {species.thumb ? (
                <Image
                  source={{ uri: `${Config.mediaUrl}/${species.thumb}` }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <BirdSVG size={26} color={Colors.textSecondary} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={2}>
                {species.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!isLoading && (
        <View style={styles.search}>
          <Text style={styles.searchLabel}>
            {showCards
              ? t("onboarding_species_other")
              : t("onboarding_species_pick")}
          </Text>
          <DropdownInput<number | null>
            placeholder={t("select_species")}
            value={null}
            setValue={handleSearchPick}
            query={speciesQuery}
            disabled={!territory || isCreating}
            type="SpeciesDropdown"
            useDefault
            sort={sort}
            onSortChange={onSortChange}
            renderOption={({ item, selected, onSelect, onClose, index }) => (
              <SpeciesOptionRow
                item={item}
                selected={selected}
                onSelect={onSelect}
                onClose={onClose}
                index={index}
              />
            )}
          />
        </View>
      )}
    </View>
  );
};

export default OnboardingSpeciesStep;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      marginBottom: 10,
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      color: Colors.textSecondary,
      marginBottom: 20,
    },
    loader: { marginVertical: 40 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
      marginBottom: 20,
    },
    card: {
      width: "30%",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 14,
      backgroundColor: Colors.primary100,
    },
    image: {
      width: CARD_IMAGE,
      height: CARD_IMAGE,
      borderRadius: 14,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    cardName: {
      fontSize: 12,
      lineHeight: 15,
      textAlign: "center",
      color: Colors.textMain,
      marginTop: 6,
    },
    search: { alignSelf: "stretch" },
    searchLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 6,
    },
  });
