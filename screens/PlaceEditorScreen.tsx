import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Keyboard, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { PressEvent } from "@maplibre/maplibre-react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useTheme, ThemeColors } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useCreatePlace, useUpdatePlace } from "../hooks/Place/useOfflinePlace";
import PlaceForm from "../components/Place/PlaceForm";
import WantToVisitSection from "../components/Place/WantToVisitSection";
import { requestPushPermission } from "../hooks/usePushNotifications";
import { combineReminder, splitReminder } from "../util/reminderDateTime";
import NearbyPlaceSuggestion from "../components/Place/NearbyPlaceSuggestion";
import {
  usePlaceLocation,
  normalizeCoords,
} from "../hooks/Place/usePlaceLocation";
import { useNearbyPlaces } from "../hooks/Place/useNearbyPlaces";
import { useDropdownQuery } from "../hooks/useDropdownQuery";
import { useLocation } from "../store/location-context";
import { fetchMyPlaces } from "../util/fetches";
import { roundCoords } from "../util/helpers";
import { callNavigationCallback } from "../util/navigationCallbacks";
import IconsHeader from "../components/ui/IconsHeader";
import { useApiError } from "../hooks/useApiError";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  AppError,
  PlaceDropdownItem,
  PlaceFormData,
  ErrorExtractor,
} from "../types";
import MapL from "../components/Map/MapL";

type FormErrors = {
  name?: string;
  territory?: string;
  latitude?: string;
  longitude?: string;
  reminder?: string;
};

// Above this, a GPS fix is unreliable enough that the dropped pin may be
// meaningfully off — nudge the user to double-check it (map tap / manual
// lat-lng entry both already work as the correction path).
const LOW_ACCURACY_THRESHOLD_M = 100;

// A point picked on a map is meant at street level, not the default
// city-wide view the GPS path starts from before it knows the accuracy.
const PICKED_POINT_ZOOM = 16;

// The form sheet's resting height: the map keeps the top half for picking
// the point, the sheet shows name, coordinates and country without a drag.
// The second point is for the rest of the form (want to visit, reminder).
const SHEET_COLLAPSED_SHARE = 0.5;
const SHEET_SNAP_POINTS = [`${SHEET_COLLAPSED_SHARE * 100}%`, "92%"];

const PlaceEditorScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"PlaceEditor">>();
  const { showErrorToast } = useApiError();

  const FORM_FIELDS = ["name", "territory", "latitude", "longitude"];

  const {
    place,
    returnToScreen,
    initialCoords: pickedCoords,
    initialWantToVisit,
  } = route.params || {};
  const isEditMode = !!place;
  const insets = useSafeAreaInsets();

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
  } = usePlaceLocation({
    followLocation: !pickedCoords,
    initialZoom: pickedCoords ? PICKED_POINT_ZOOM : undefined,
  });

  const createPlaceMutation = useCreatePlace();
  const updatePlaceMutation = useUpdatePlace(place?.id);

  const [formData, setFormData] = useState<PlaceFormData>({
    name: place?.name ?? "",
    territory: place?.territory ? Number(place.territory) : 0,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const [wantToVisit, setWantToVisit] = useState(
    place ? !!place.want_to_visit : !!initialWantToVisit,
  );
  const [reminderDate, setReminderDate] = useState(
    () => splitReminder(place?.visit_reminder_at).date,
  );
  const [reminderTime, setReminderTime] = useState(
    () => splitReminder(place?.visit_reminder_at).time,
  );
  const pickedReminder = combineReminder(reminderDate, reminderTime);
  const storedReminderMs = place?.visit_reminder_at
    ? new Date(place.visit_reminder_at).getTime()
    : null;
  // A reminder this save actually sets, as opposed to one already stored
  // (even one already past, which an unrelated edit must not trip over).
  const isNewReminder =
    wantToVisit &&
    !!pickedReminder &&
    pickedReminder.getTime() !== storedReminderMs;

  // Height of the screen under the header, for the sheet's share of it.
  const [containerHeight, setContainerHeight] = useState(0);
  const collapsedSheetHeight = containerHeight * SHEET_COLLAPSED_SHARE;
  const initialCoords = place?.location?.coordinates;

  const { locationCoords, locationAvailable, permissionStatus, requestLocation } =
    useLocation();

  // Deliberately the exact same query the editors' own place dropdown runs
  // (same type, same params), so arriving here from an observation/diary form
  // is a cache hit: no request, and the suggestion works offline for free.
  // `enabled` only gates the fetch — cached data still comes back.
  const { query: queryPlaces } = useDropdownQuery({
    type: "PlacesDropdown",
    queryFn: (sort) => fetchMyPlaces(formData.territory || null, locationCoords, sort),
    params: [formData.territory || null, roundCoords(locationCoords)],
    enabled: !isEditMode && !!formData.territory,
    locationAvailable,
    requestLocation,
    permissionStatus,
  });

  // Measured from the pin, not from the phone: the user may well be pinning a
  // spot they are looking at from across a field.
  const nearby = useNearbyPlaces({
    coords,
    // 0 is this hook's "no fix" value, and after a manual pin it is also what
    // updateCoords resets to — neither is an accuracy to widen anything by.
    accuracy: accuracy > 0 ? accuracy : null,
    places: queryPlaces.data,
  });

  const showSuggestion =
    !isEditMode && !isLocating && !suggestionDismissed && !!nearby.nearest;

  const buildPlacePayload = (data: PlaceFormData): PlaceFormData => {
    const payload: PlaceFormData = {
      name: data.name.trim(),
      favourite: data.favourite ?? false,
      territory: data.territory,
      want_to_visit: data.want_to_visit ?? false,
      visit_reminder_at: data.visit_reminder_at ?? null,
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

  const handleUseExistingPlace = useCallback(
    (suggested: PlaceDropdownItem) => {
      Keyboard.dismiss();
      const placeId = Number(suggested.value);

      if (returnToScreen) {
        // The very callback the create path fires. To the form that opened
        // this screen the only thing that matters is that the place is
        // settled — whether it was just created or picked out of the
        // neighbourhood makes no difference to it.
        callNavigationCallback("onPlaceCreated", placeId, formData.territory, {
          id: placeId,
          name: suggested.label ?? suggested.name ?? null,
          preview: suggested.preview ?? null,
          location: suggested.location ?? null,
        });
        navigation.goBack();
        return;
      }

      navigation.replace("PlaceDetail", { placeId });
    },
    [returnToScreen, formData.territory, navigation],
  );

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
    if (!isEditMode && pickedCoords) {
      // A point tapped on the place picker's map: the user already said where
      // the place is, so no GPS fix. Same path as a tap on this screen's own
      // map — the reverse geocode fills in the name and the country.
      const normalized = normalizeCoords(pickedCoords[0], pickedCoords[1]);
      if (normalized) {
        const { lngText, latText, lng, lat } = normalized;
        updateCoords([lng, lat], {
          fromManual: true,
          latText,
          lngText,
          withGeocode: true,
        });
        return;
      }
    }
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
    // The reminder is optional, but half of one (a day with no time, or the
    // other way round) is more likely a slip than "no reminder".
    if (wantToVisit && (reminderDate || reminderTime)) {
      if (!pickedReminder) newErrors.reminder = t("reminder_incomplete");
      else if (isNewReminder && pickedReminder.getTime() <= Date.now())
        newErrors.reminder = t("reminder_in_past");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    formData,
    latText,
    lngText,
    t,
    wantToVisit,
    reminderDate,
    reminderTime,
    pickedReminder,
    isNewReminder,
  ]);

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => ({
      title: isEditMode ? t("update_failed") : t("create_failed"),
      message:
        // err.response is undefined for any response-less failure (offline,
        // timeout, unreachable backend) — Object.values(undefined) throws, so
        // this only ever ran the happy path where the server actually replied
        // (see the matching fix in ObservationEditorScreen for the original
        // report of this crash).
        (err?.response?.data
          ? Object.values(err.response.data).flat().join("\n")
          : "") ||
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

  const handleWantToVisitChange = useCallback((value: boolean) => {
    setWantToVisit(value);
    setErrors((prev) => ({ ...prev, reminder: undefined }));
  }, []);

  const handleReminderDateChange = useCallback((value: string | null) => {
    setReminderDate(value);
    setErrors((prev) => ({ ...prev, reminder: undefined }));
  }, []);

  const handleReminderTimeChange = useCallback((value: string | null) => {
    setReminderTime(value);
    setErrors((prev) => ({ ...prev, reminder: undefined }));
  }, []);

  const handleSavePlace = useCallback(async () => {
    if (!validateForm()) return;

    // Asked here, when the user has just picked a reminder — the same rule as
    // requestPushPermission's other callers. A refusal still saves the place
    // and its moment: it reaches the user's other devices, and is scheduled
    // here once notifications are allowed in the OS settings.
    if (isNewReminder && !(await requestPushPermission())) {
      Toast.show({
        type: "info",
        text1: t("reminder_permission_denied"),
        text2: t("reminder_permission_denied_hint"),
      });
    }

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
      want_to_visit: wantToVisit,
      // Leaving the list takes the reminder with it, as on PlaceDetailScreen.
      visit_reminder_at: wantToVisit
        ? (pickedReminder?.toISOString() ?? null)
        : null,
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
  }, [
    formData,
    lngText,
    latText,
    isEditMode,
    place,
    returnToScreen,
    wantToVisit,
    pickedReminder,
    isNewReminder,
    validateForm,
    t,
  ]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: true,
        onPress: () => {
          handleSavePlace();
        },
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

  // The map runs under the whole screen; the form is a sheet over its lower
  // part. The camera and the "Update GPS" button are lifted by the sheet's
  // resting height so the pin and the button stay in the part left visible.
  return (
    <View
      style={styles.screen}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <MapL
        onPress={handleMapPress}
        currentCoords={coords}
        currentZoom={zoom}
        accuracy={accuracy}
        onUseMyLocation={locateMe}
        isLocating={isLocating}
        bottomInset={collapsedSheetHeight}
        centerBottomPadding={collapsedSheetHeight}
      />
      <BottomSheet
        index={0}
        snapPoints={SHEET_SNAP_POINTS}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          testID="place-editor-sheet"
        >
          {!isLocating && accuracy > LOW_ACCURACY_THRESHOLD_M && (
            <Text style={styles.lowAccuracyHint}>
              {t("gps_low_accuracy_hint")}
            </Text>
          )}
          {showSuggestion && (
            <View style={styles.suggestionWrapper}>
              <NearbyPlaceSuggestion
                {...nearby}
                variant="editor"
                onSelect={handleUseExistingPlace}
                onDismiss={() => setSuggestionDismissed(true)}
              />
            </View>
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
          <WantToVisitSection
            value={wantToVisit}
            onChange={handleWantToVisitChange}
            reminderDate={reminderDate}
            reminderTime={reminderTime}
            onReminderDateChange={handleReminderDateChange}
            onReminderTimeChange={handleReminderTimeChange}
            reminderError={errors.reminder}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};

export default PlaceEditorScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Colors.primary100 },
    sheetBackground: {
      backgroundColor: Colors.primary100,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    sheetHandle: {
      backgroundColor: Colors.textSecondary,
      width: 40,
      height: 4,
    },
    lowAccuracyHint: {
      fontSize: 12,
      color: Colors.error600,
      textAlign: "center",
      marginTop: 6,
      marginHorizontal: 16,
    },
    suggestionWrapper: {
      marginTop: 12,
      marginHorizontal: 16,
    },
  });
