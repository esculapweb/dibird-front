import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { Platform, StyleSheet, View, KeyboardAvoidingView } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useUpdateItem } from "../hooks/useItem";
import { useCreatePlace } from "../hooks/Place/usePlaceMutation";
import PlaceForm from "../components/Place/PlaceForm";
import {
  usePlaceLocation,
  normalizeCoords,
} from "../hooks/Place/usePlaceLocation";
import Map from "../components/Map/Map";
import { showError } from "../services/api";
import { callNavigationCallback } from "../util/navigationCallbacks";
import IconsHeader from "../components/ui/IconsHeader";

const PlaceEditorScreen = ({ navigation, route }) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const type = "Place";

  const FORM_FIELDS = ["name", "territory", "latitude", "longitude"];

  const { place, returnToScreen } = route.params || {};
  const isEditMode = !!place;

  const {
    coords,
    zoom,
    accuracy,
    details,
    latText,
    setLatText,
    lngText,
    setLngText,
    isLoading: isLocating,
    updateCoords,
    useMyLocation,
  } = usePlaceLocation();

  const createPlaceMutation = useCreatePlace();
  const updatePlaceMutation = useUpdateItem(place?.id, type);

  const [formData, setFormData] = useState({
    name: place?.name ?? "",
    territory: place?.territory ?? "",
  });
  const [errors, setErrors] = useState({});
  const initialCoords = place?.location?.coordinates ?? [0, 0];

  const handleMapPress = useCallback(
    (e) => {
      if (isLocating) return;
      const [lng, lat] = e.geometry.coordinates;
      const normalized = normalizeCoords(lng, lat);
      if (!normalized) return;
      const {
        lngText: newLngText,
        latText: newLatText,
        lng: newLng,
        lat: newLat,
      } = normalized;
      updateCoords([newLng, newLat], {
        fromManual: true,
        latText: newLatText,
        lngText: newLngText,
        withGeocode: true,
      });
      setErrors((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
    },
    [updateCoords, isLocating],
  );

  useEffect(() => {
    if (!isEditMode) {
      useMyLocation();
    } else {
      const normalized = normalizeCoords(initialCoords[0], initialCoords[1]);
      if (normalized) {
        const { lngText, latText, lng, lat } = normalized;
        updateCoords([lng, lat]);
        setLatText(latText);
        setLngText(lngText);
      }
    }
  }, []);

  useEffect(() => {
    if (!details || isEditMode) return;
    const getSuggestedName = (d) => {
      if (d?.city && d?.raw?.county) return `${d.city}, ${d?.raw?.county}`;
      if (d?.city) return d.city;
      if (d?.address) return d.address;
      return "";
    };
    const suggestedName = getSuggestedName(details);
    if (!suggestedName) return;
    setFormData((prev) => ({ ...prev, name: suggestedName }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  }, [details, isEditMode]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t("name_required");
    else if (formData.name.trim().length > 254)
      newErrors.name = t("name_too_long");
    if (!formData?.territory) newErrors.territory = t("territory_required");
    if (!latText?.trim()) {
      newErrors.latitude = t("invalid_latitude");
    } else {
      const lat = Number(latText);
      if (isNaN(lat) || lat < -90 || lat > 90)
        newErrors.latitude = t("invalid_latitude");
    }
    if (!lngText?.trim()) {
      newErrors.longitude = t("invalid_longitude");
    } else {
      const lng = Number(lngText);
      if (isNaN(lng) || lng < -180 || lng > 180)
        newErrors.longitude = t("invalid_longitude");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, latText, lngText, t]);

  const extractApiError = (e) => ({
    title: isEditMode ? t("update_failed") : t("create_failed"),
    message:
      Object.values(e?.response?.data).flat().join("\n") ||
      (isEditMode ? t("could_not_update_place") : t("could_not_create_place")),
  });

  const handleMutateError = (e) => {
    const data = e?.response?.data;
    if (!data) {
      showError(e, extractApiError);
      return;
    }
    const errorField = FORM_FIELDS.find((field) => data?.[field]);
    errorField
      ? setErrors((prev) => ({ ...prev, [errorField]: data[errorField] }))
      : showError(e, extractApiError);
  };

  const handleCoordsChange = ([lngInput, latInput], options) => {
    const normalized = normalizeCoords(lngInput, latInput, 4, true);
    if (normalized) {
      const { lngText: newLngText, latText: newLatText, lng, lat } = normalized;
      updateCoords([lng, lat], {
        ...options,
        latText: newLatText,
        lngText: newLngText,
        withGeocode: true,
      });
      setErrors((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
    } else {
      setLatText(latInput ?? "");
      setLngText(lngInput ?? "");
      setErrors((prev) => ({
        ...prev,
        latitude: latInput ? undefined : t("invalid_latitude"),
        longitude: lngInput ? undefined : t("invalid_longitude"),
      }));
    }
  };

  const handleSavePlace = useCallback(() => {
    if (!validateForm()) return;
    const normalized = normalizeCoords(lngText, latText, 4);
    if (!normalized) return;
    const { lng, lat, lngText: newLngText, latText: newLatText } = normalized;
    updateCoords([lng, lat], {
      fromManual: true,
      normalizeOnSave: true,
      withGeocode: false,
    });
    setLatText(newLatText);
    setLngText(newLngText);

    const placeData = {
      name: formData.name.trim(),
      location: { type: "Point", coordinates: [lng, lat] },
      territory: formData.territory,
      favourite: place?.favourite ?? false,
    };

    if (isEditMode) {
      updatePlaceMutation.mutate(placeData, {
        onSuccess: () => navigation.goBack(),
        onError: (e) => handleMutateError(e),
      });
    } else {
      createPlaceMutation.mutate(placeData, {
        onSuccess: (res) => {
          if (returnToScreen) {
            callNavigationCallback(
              "onPlaceCreated",
              res.data.id,
              placeData.territory,
              res.data,
            );
            navigation.goBack();
          } else {
            requestAnimationFrame(() =>
              navigation.replace("PlaceDetail", { placeId: res.data.id }),
            );
          }
        },
        onError: (e) => handleMutateError(e),
      });
    }
  }, [formData, lngText, latText, isEditMode, place, returnToScreen]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: true,
        onPress: handleSavePlace,
        icon: "checkmark-circle",
        size: 36,
        tintColor: Colors.seenIcon,
        disabled:
          isLocating ||
          (isEditMode
            ? updatePlaceMutation.isPending
            : createPlaceMutation.isPending),
      },
    ],
    [
      handleSavePlace,
      isLocating,
      isEditMode,
      createPlaceMutation.isPending,
      updatePlaceMutation.isPending,
      Colors.seenIcon,
    ],
  );

  const headerRight = () => (
    <IconsHeader headerRightBeginning={headerRightBeginning} />
  );

  const headerRightKey = useMemo(
    () =>
      headerRightBeginning
        ?.map((btn) => `${btn.icon}-${btn.disabled}-${btn.loading}`)
        .join("|"),
    [headerRightBeginning],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_place") : t("new_place"),
      headerRight,
    });
  }, [navigation, headerRightKey, isEditMode]);

  if (
    isEditMode ? updatePlaceMutation.isPending : createPlaceMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.mapContainer}>
        <Map
          onPress={handleMapPress}
          currentCoords={coords}
          currentZoom={zoom}
          accuracy={accuracy}
          onUseMyLocation={useMyLocation}
          isLocating={isLocating}
        />
      </View>
      <PlaceForm
        onCoordsChange={handleCoordsChange}
        formData={formData}
        coords={coords}
        latText={latText}
        setLatText={setLatText}
        lngText={lngText}
        setLngText={setLngText}
        setFormData={setFormData}
        errors={errors}
        setErrors={setErrors}
        locationDetails={details}
      />
    </KeyboardAvoidingView>
  );
};

export default PlaceEditorScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.primary100 },
    mapContainer: { flex: 1 },
  });
