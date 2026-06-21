import { Dispatch, SetStateAction, useEffect } from "react";
import { useTranslation } from "react-i18next";

import DropdownInput from "../ui/DropdownInput";
import DateInput from "../ui/DateInput";
import { fetchMyCountries, fetchMyPlaces } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import Input from "../ui/Input";
import Section from "../ui/Section";
import PrivacyToggle from "../ui/PrivacyToggle";
import PlaceBlock from "../Place/PlaceBlock";
import { useLocation } from "../../store/location-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import { DiaryFormData, PlaceDropdownItem, Errors } from "../../types";

interface DiaryFormProps {
  formData: DiaryFormData;
  setFormData: Dispatch<SetStateAction<DiaryFormData>>;
  errors: Errors;
  setErrors: Dispatch<SetStateAction<Errors>>;
  territoryValue: number | null;
  setTerritoryValue: (value: number | null) => void;
  placeValue: number | null;
  setPlaceValue: (value: number | null) => void;
  onAddNewPlace: () => void;
  placeData: PlaceDropdownItem | null;
  setPlaceData: Dispatch<SetStateAction<PlaceDropdownItem | null>>;
  isEditMode?: boolean;
}

const DiaryForm = ({
  formData,
  setFormData,
  errors,
  setErrors,
  territoryValue,
  setTerritoryValue,
  placeValue,
  setPlaceValue,
  onAddNewPlace,
  placeData,
  setPlaceData,
  isEditMode,
}: DiaryFormProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const {
    locationCoords,
    locationAvailable,
    permissionStatus,
    requestLocation,
  } = useLocation();

  useEffect(() => {
    if (!territoryValue) return;
    if (permissionStatus === "denied") return;
    if (locationAvailable) return;

    requestLocation();
  }, [territoryValue]);

  const handleLocationUnavailable = useLocationUnavailable();

  const {
    query: queryMyCountries,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
  });

  const {
    query: queryPlaces,
    sort: placesSort,
    onSortChange: onPlacesSortChange,
  } = useDropdownQuery({
    type: "PlacesDropdown",
    queryFn: (sort) => fetchMyPlaces(territoryValue, locationCoords, sort),
    params: [territoryValue, locationCoords],
    enabled: !!territoryValue,
    locationAvailable,
    requestLocation,
    permissionStatus,
    onLocationUnavailable: handleLocationUnavailable,
  });

  return (
    <>
      <Section title={t("section_main")} required collapsible={true}>
        <DropdownInput
          placeholder={t("select_country")}
          value={territoryValue}
          setValue={(val) => {
            setTerritoryValue(val as number | null);
            setFormData((prev) => ({
              ...prev,
              territory: val as number | null,
            }));
            setErrors((prev) => ({ ...prev, territory: undefined }));
            setPlaceValue(null);
          }}
          query={queryMyCountries}
          error={errors.territory}
          type="CountriesDropdown"
          sort={countriesSort}
          onSortChange={onCountriesSortChange}
          disabled={isEditMode}
        />

        <DateInput
          value={formData.date_time ?? ""}
          onChange={(newDate) => {
            setFormData((prev) => ({ ...prev, date_time: newDate }));
            setErrors((prev) => ({ ...prev, date_time: undefined }));
          }}
          placeholder={t("diary_date")}
          error={errors.date_time}
          allowClear={false}
          style={{ marginBottom: 16 }}
        />

        <Input
          value={formData.name ?? ""}
          onUpdateValue={(val) =>
            setFormData((prev) => ({ ...prev, name: val }))
          }
          error={errors.name}
          isInvalid={!!errors.name}
          icon="document-text-outline"
          placeholder={t("add_a_note")}
          multiline
        />

        <PrivacyToggle
          value={formData.private ?? false}
          onChange={(val) => setFormData((prev) => ({ ...prev, private: val }))}
          descriptionType="male"
        />
      </Section>

      {/* ── 3. Optional: Where ───────────────────────────────── */}
      <Section
        title={t("section_where")}
        hint={t("optional")}
        collapsible={true}
      >
        <PlaceBlock
          territoryValue={territoryValue}
          placeValue={placeValue}
          setPlaceValue={setPlaceValue}
          setFormData={setFormData}
          onAddNewPlace={onAddNewPlace}
          queryPlaces={queryPlaces}
          sort={placesSort}
          onSortChange={onPlacesSortChange}
          placeData={placeData}
          setPlaceData={setPlaceData}
          locationAvailable={locationAvailable}
          onLocationUnavailable={handleLocationUnavailable}
          showLocationPrivacy={!formData.private && !!placeValue}
          privateLocation={formData.location_private}
          setPrivateLocation={(val: boolean) =>
            setFormData((prev) => ({ ...prev, location_private: val }))
          }
        />
      </Section>
    </>
  );
};

export default DiaryForm;
