import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getSession } from "../util/sessionStore";
import { toDateOnly } from "../util/helpers";
import {
  Profile,
  EditorItem,
  SpeciesDropdownItem,
  PlaceDropdownItem,
} from "../types";

interface UseEditorFormParams {
  item: EditorItem | null;
  defaultTerritory?: number | "";
  defaultPlace?: number | null;
  defaultSpecies?: number | null;
  profile?: Profile | null;
  hasSpecies?: boolean;
  requiredFields?: string[];
  diaryId?: number | null;
}

export interface EditorFormData {
  territory: number | "";
  place: number | null;
  date_time: string | null | undefined;
  time: string | null;
  private: boolean | undefined;
  quantity: number | null;
  notes: string | null;
  name: string | null;
  diary: number | null;
  species?: number | null;
}

type ParsedEditorItem = Omit<EditorItem, "date_time"> & {
  date_time?: string | null;
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
        ...item,
        date_time: item.date_time ? toDateOnly(item.date_time) : undefined,
      }
    : undefined;

  const [territoryValue, setTerritoryValue] = useState(
    () => itemWithParsedDate?.territory ?? defaultTerritory ?? "",
  );
  const [speciesValue, setSpeciesValue] = useState(() =>
    hasSpecies ? (itemWithParsedDate?.species ?? defaultSpecies ?? null) : null,
  );
  const [placeValue, setPlaceValue] = useState(
    () => itemWithParsedDate?.place ?? defaultPlace ?? null,
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
      quantity: itemWithParsedDate?.quantity ?? null,
      notes: itemWithParsedDate?.notes ?? null,
      name: itemWithParsedDate?.name ?? null,
      diary: diaryId,
    };

    if (hasSpecies) base.species = speciesValue;
    return base;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [speciesData, setSpeciesData] = useState<SpeciesDropdownItem | null>(
    itemWithParsedDate
      ? {
          value: itemWithParsedDate.species_data.id,
          label: itemWithParsedDate.species_data.name_lang,
          name: itemWithParsedDate.species_data.name,
          name_lang: itemWithParsedDate.species_data.name_lang,
          thumb: itemWithParsedDate.species_data.thumb,
        }
      : null,
  );
  const [placeData, setPlaceData] = useState<PlaceDropdownItem | null>(
    itemWithParsedDate?.place_data
      ? {
          value: itemWithParsedDate.place_data.id,
          label: itemWithParsedDate.place_data.name,
          preview: itemWithParsedDate.place_data.preview ?? undefined,
          location: itemWithParsedDate.place_data.location,
        }
      : null,
  );

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
