// Presets for the "within N km" filter (places and the community feed). The
// same steps the alert settings offer (see components/ui/RadiusRow.tsx), plus
// the intermediate ones a list filter needs: alerts pick one radius once,
// while a list is narrowed down again and again.
//
// The centre is always the device's current position, so the filter is only
// offered when location is available — the backend has nothing to apply the
// radius to without lng/lat and ignores it (ObservationFilterSet.filter_radius).
export const RADIUS_OPTIONS_KM = [5, 10, 25, 50, 100, 250, 500] as const;
