import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getSession } from "../util/sessionStore";
import { toDateOnly } from "../util/helpers";
import {
  Profile,
  EditorItem,
  DiaryItem,
  ObservationItem,
  SpeciesDropdownItem,
  PlaceDropdownItem,
  SpeciesData,
  PlaceData,
  TerritoryData,
  Errors,
  EditorFormData,
} from "../types";

interface UseEditorFormParams {
  item: EditorItem | DiaryItem | ObservationItem | null;
  defaultTerritory?: number | null;
  defaultPlace?: number | null;
  defaultSpecies?: number | null;
  profile?: Profile | null;
  hasSpecies?: boolean;
  requiredFields?: string[];
  diaryId?: number | null;
}

type ParsedEditorItem = {
  date_time?: string | null;
  id?: number;
  territory?: number | null;
  territory_data?: TerritoryData | null;
  place?: number | null;
  place_data?: PlaceData | null;
  private?: boolean;
  location_private: boolean;
  name?: string | null;
  notes?: string | null;
  time?: string | null;
  quantity?: number | null;
  diary?: number | null;
  species?: number | null;
  species_data?: SpeciesData | null;
};

export const useEditorForm = ({
  item,
  defaultTerritory,
  defaultPlace,
  defaultSpecies = null,
  profile,
  hasSpecies = false,
  requiredFields = [],
  diaryId = null,
}: UseEditorFormParams) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const itemWithParsedDate: ParsedEditorItem | undefined = item
    ? {
        ...(item as DiaryItem | ObservationItem | EditorItem),
        date_time: item.date_time ? toDateOnly(item.date_time) : undefined,
      }
    : undefined;

  const [territoryValue, setTerritoryValue] = useState<number | null>(
    () =>
      itemWithParsedDate?.territory ??
      itemWithParsedDate?.territory_data?.id ??
      defaultTerritory ??
      null,
  );
  const [speciesValue, setSpeciesValue] = useState(() =>
    hasSpecies
      ? (itemWithParsedDate?.species ??
        itemWithParsedDate?.species_data?.id ??
        defaultSpecies ??
        null)
      : null,
  );
  const [placeValue, setPlaceValue] = useState(
    () =>
      itemWithParsedDate?.place ??
      itemWithParsedDate?.place_data?.id ??
      defaultPlace ??
      null,
  );

  const [formData, setFormData] = useState(() => {
    const sessionDate = getSession<string>("lastDate");
    const fallback = sessionDate ?? toDateOnly(new Date());
    const initialDate = itemWithParsedDate?.date_time ?? fallback;

    const base: EditorFormData = {
      territory: territoryValue,
      place: placeValue,
      date_time: initialDate,
      time: itemWithParsedDate?.time ?? null,
      private: itemWithParsedDate?.private ?? profile?.private_diary,
      location_private: itemWithParsedDate?.location_private ?? true,
      quantity: itemWithParsedDate?.quantity ?? null,
      notes: itemWithParsedDate?.notes ?? null,
      name: itemWithParsedDate?.name ?? null,
      diary: diaryId,
    };

    if (hasSpecies) base.species = speciesValue;
    return base;
  });

  const [errors, setErrors] = useState<Errors>({});

  const [speciesData, setSpeciesData] = useState<SpeciesDropdownItem | null>(
    () => {
      const sd = itemWithParsedDate?.species_data;
      if (!sd) return null;
      return {
        value: sd.id,
        label: sd.name_lang,
        name: sd.name,
        name_lang: sd.name_lang,
        segment: sd.segment,
        thumb: sd.thumb ?? undefined,
      };
    },
  );
  const [placeData, setPlaceData] = useState<PlaceDropdownItem | null>(() => {
    const pd = itemWithParsedDate?.place_data;
    if (!pd) return null;
    return {
      value: pd.id,
      label: pd.name,
      name: pd.name,
      preview: pd.preview ?? undefined,
      location: pd.location ?? undefined,
    };
  });

  useEffect(() => {
    if (!speciesValue || speciesData) return;
    const cache = queryClient.getQueriesData<SpeciesDropdownItem[]>({
      queryKey: ["SpeciesDropdown"],
    });

    for (const [, data] of cache) {
      const found = data?.find?.((item) => item.value === speciesValue);
      if (found) {
        setSpeciesData(found);
        break;
      }
    }
  }, [speciesValue]);

  useEffect(() => {
    if (!placeValue || placeData) return;
    const cache = queryClient.getQueriesData<PlaceDropdownItem[]>({
      queryKey: ["PlacesDropdown"],
    });
    for (const [, data] of cache) {
      const found = data?.find?.((item) => item.value === placeValue);
      if (found) {
        setPlaceData(found);
        break;
      }
    }
  }, [placeValue]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (requiredFields.includes("territory") && !territoryValue)
      newErrors.territory = t("territory_required");
    if (requiredFields.includes("species") && !speciesValue)
      newErrors.species = t("species_required");
    if (requiredFields.includes("date_time") && !formData.date_time)
      newErrors.date_time = t("date_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [territoryValue, speciesValue, formData.date_time, requiredFields, t]);

  return {
    itemWithParsedDate,
    formData,
    setFormData,
    errors,
    setErrors,
    territoryValue,
    setTerritoryValue,
    speciesValue,
    setSpeciesValue,
    placeValue,
    setPlaceValue,
    speciesData,
    setSpeciesData,
    placeData,
    setPlaceData,
    validateForm,
  };
};
