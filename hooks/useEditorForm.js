import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getSession } from "../util/sessionStore";

export const useEditorForm = ({
  item,
  defaultTerritory,
  defaultPlace,
  defaultSpecies = null,
  profile,
  hasSpecies = false,
  requiredFields = [],
  diaryId = null
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const itemWithParsedDate = item
    ? {
        ...item,
        date_time: item.date_time ? new Date(item.date_time) : undefined,
      }
    : undefined;

  const [territoryValue, setTerritoryValue] = useState(
    () => itemWithParsedDate?.territory ?? defaultTerritory ?? "",
  );
  const [speciesValue, setSpeciesValue] = useState(
    () => hasSpecies ? (itemWithParsedDate?.species ?? defaultSpecies ?? null) : null,
  );
  const [placeValue, setPlaceValue] = useState(
    () => itemWithParsedDate?.place ?? defaultPlace ?? null,
  );

  const [formData, setFormData] = useState(() => {
    const initialDate =
      itemWithParsedDate?.date_time ?? getSession("lastDate") ?? new Date();

    const base = {
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

  const [errors, setErrors] = useState({});
  const [speciesData, setSpeciesData] = useState(
    itemWithParsedDate?.species_data ?? null,
  );
  const [placeData, setPlaceData] = useState(
    itemWithParsedDate?.place_data ?? null,
  );

  useEffect(() => {
    if (!speciesValue || speciesData) return;
    const cache = queryClient.getQueriesData({ queryKey: ["SpeciesDropdown"] });
    for (const [, data] of cache) {
      const found = data?.find?.((item) => item.value === speciesValue);
      if (found) { setSpeciesData(found); break; }
    }
  }, [speciesValue]);

  useEffect(() => {
    if (!placeValue || placeData) return;
    const cache = queryClient.getQueriesData({ queryKey: ["PlacesDropdown"] });
    for (const [, data] of cache) {
      const found = data?.find?.((item) => item.value === placeValue);
      if (found) { setPlaceData(found); break; }
    }
  }, [placeValue]);

  const validateForm = () => {
    const newErrors = {};
    if (requiredFields.includes("territory") && !territoryValue)
      newErrors.territory = t("territory_required");
    if (requiredFields.includes("species") && !speciesValue)
      newErrors.species = t("species_required");
    if (requiredFields.includes("date_time") && !formData.date_time)
      newErrors.date_time = t("date_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return {
    itemWithParsedDate,
    formData, setFormData,
    errors, setErrors,
    territoryValue, setTerritoryValue,
    speciesValue, setSpeciesValue,
    placeValue, setPlaceValue,
    speciesData, setSpeciesData,
    placeData, setPlaceData,
    validateForm,
  };
};