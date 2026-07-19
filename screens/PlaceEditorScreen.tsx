import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Keyboard, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { PressEvent } from "@maplibre/maplibre-react-native";

import { useTheme, ThemeColors } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useCreatePlace, useUpdatePlace } from "../hooks/Place/useOfflinePlace";
import PlaceForm from "../components/Place/PlaceForm";
import {
  usePlaceLocation,
  normalizeCoords,
} from "../hooks/Place/usePlaceLocation";
import { callNavigationCallback } from "../util/navigationCallbacks";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import { useApiError } from "../hooks/useApiError";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  AppError,
  PlaceFormData,
  ErrorExtractor,
} from "../types";
import MapL from "../components/Map/MapL";

type FormErrors = {
  name?: string;
  territory?: string;
  latitude?: string;
  longitude?: string;
};

// Above this, a GPS fix is unreliable enough that the dropped pin may be
// meaningfully off — nudge the user to double-check it (map tap / manual
// lat-lng entry both already work as the correction path).
const LOW_ACCURACY_THRESHOLD_M = 100;

const PlaceEditorScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"PlaceEditor">>();
  const { showErrorToast } = useApiError();

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
    isLocating,
    updateCoords,
    locateMe,
  } = usePlaceLocation();

  const createPlaceMutation = useCreatePlace();
  const updatePlaceMutation = useUpdatePlace(place?.id);

  const [formData, setFormData] = useState<PlaceFormData>({
    name: place?.name ?? "",
    territory: place?.territory ? Number(place.territory) : 0,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const initialCoords = place?.location?.coordinates;

  const buildPlacePayload = (data: PlaceFormData): PlaceFormData => {
    const payload: PlaceFormData = {
      name: data.name.trim(),
      favourite: data.favourite ?? false,
      territory: data.territory,
    };

    if (data.location?.coordinates) {
      payload.location = {
        type: "Point",
        coordinates: [
          Number(data.location.coordinates[0]),
          Number(data.location.coordinates[1]),
        ],
      };
    }

    return payload;
  };

  const handleMapPress = useCallback(
    (e: PressEvent) => {
      if (isLocating) return;
      if (!e?.lngLat) return;

      const [lng, lat] = e.lngLat;
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
      locateMe();
    } else {
      if (!initialCoords) return;
      const normalized = normalizeCoords(initialCoords[0], initialCoords[1]);
      if (normalized) {
        const { lngText, latText, lng, lat } = normalized;
        updateCoords([lng, lat]);
        setLatText(latText);
        setLngText(lngText);
      }
    }
  }, [isEditMode]);

  // A previous suggestion, so a late-arriving reverse-geocode (debounced,
  // then a real network round-trip) can be told apart from a name the user
  // already typed over it — without this, typing a custom name while the
  // geocode is still in flight gets silently clobbered/appended-to the
  // moment `details` updates.
  const lastSuggestedNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!details || isEditMode) return;
    const suggestedName = details?.name ?? "";
    if (!suggestedName) return;
    setFormData((prev) => {
      if (prev.name && prev.name !== lastSuggestedNameRef.current) return prev;
      return { ...prev, name: suggestedName };
    });
    lastSuggestedNameRef.current = suggestedName;
    setErrors((prev) => ({ ...prev, name: undefined }));
  }, [details, isEditMode]);

  const validateForm = useCallback(() => {
    const newErrors: FormErrors = {};
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

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => ({
      title: isEditMode ? t("update_failed") : t("create_failed"),
      message:
        Object.values(err?.response?.data).flat().join("\n") ||
        (isEditMode
          ? t("could_not_update_place")
          : t("could_not_create_place")),
    }),
    [t],
  );

  const handleMutateError = (e: AppError) => {
    const data = e?.response?.data;
    if (!data) {
      showErrorToast(e, "PlaceEditorScreen:handleMutateError", extractApiError);
      return;
    }
    const errorField = FORM_FIELDS.find((field) => data?.[field]);
    if (errorField) {
      setErrors((prev) => ({ ...prev, [errorField]: data[errorField] }));
    } else {
      showErrorToast(e, "PlaceEditorScreen:handleMutateError", extractApiError);
    }
  };

  const handleCoordsChange = useCallback(
    (
      [lngInput, latInput]: [string, string],
      options?: { fromManual?: boolean },
    ) => {
      const normalized = normalizeCoords(lngInput, latInput, 4, true);
      if (normalized) {
        const {
          lngText: newLngText,
          latText: newLatText,
          lng,
          lat,
        } = normalized;
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
        setLatText(String(latInput) ?? "");
        setLngText(String(lngInput) ?? "");
        setErrors((prev) => ({
          ...prev,
          latitude: latInput ? undefined : t("invalid_latitude"),
          longitude: lngInput ? undefined : t("invalid_longitude"),
        }));
      }
    },
    [updateCoords, setLatText, setLngText, t],
  );

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

    const placeData = buildPlacePayload({
      ...formData,
      favourite: place?.favourite ?? false,
      location: { type: "Point", coordinates: [lng, lat] },
      territory: formData.territory,
    });

    if (isEditMode) {
      updatePlaceMutation.mutate(placeData, {
        onSuccess: () => {
          Keyboard.dismiss();
          navigation.goBack();
        },
        onError: (e) => handleMutateError(e),
      });
    } else {
      createPlaceMutation.mutate(placeData, {
        onSuccess: (item) => {
          Keyboard.dismiss();
          if (returnToScreen) {
            callNavigationCallback(
              "onPlaceCreated",
              item.id,
              placeData.territory,
              item,
            );
            navigation.goBack();
          } else {
            requestAnimationFrame(() =>
              navigation.replace("PlaceDetail", {
                placeId: item.id,
                initialPlace: item,
              }),
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
        icon: "checkmark-circle" as const,
        size: 36,
        tintColor: Colors.main100,
        disabled:
          isLocating ||
          (isEditMode
            ? updatePlaceMutation.isPending
            : createPlaceMutation.isPending),
        testID: "place-save-button",
      },
    ],
    [
      handleSavePlace,
      isLocating,
      isEditMode,
      createPlaceMutation.isPending,
      updatePlaceMutation.isPending,
      Colors.main100,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_place") : t("new_place"),
      headerRight: () => (
        <IconsHeader headerRightBeginning={headerRightBeginning} />
      ),
    });
  }, [navigation, isEditMode, headerRightBeginning]);

  if (
    isEditMode ? updatePlaceMutation.isPending : createPlaceMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

  return (
    <Layout withKeyboard={true}>
      <MapL
        onPress={handleMapPress}
        currentCoords={coords}
        currentZoom={zoom}
        accuracy={accuracy}
        onUseMyLocation={locateMe}
        isLocating={isLocating}
      />
      {!isLocating && accuracy > LOW_ACCURACY_THRESHOLD_M && (
        <Text style={styles.lowAccuracyHint}>
          {t("gps_low_accuracy_hint")}
        </Text>
      )}
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
        isEditMode={isEditMode}
      />
    </Layout>
  );
};

export default PlaceEditorScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    lowAccuracyHint: {
      fontSize: 12,
      color: Colors.error600,
      textAlign: "center",
      marginTop: 6,
      marginHorizontal: 16,
    },
  });
