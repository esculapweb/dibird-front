// Deletes every place of the test account that sits within RADIUS_M of
// (FIX_LAT, FIX_LNG) — the mock GPS fix a flow is about to use.
//
// Why: online-nearby-place.yaml checks that the suggestion card offers *its
// own* freshly created anchor. The card shows the nearest place, so any other
// place at the same spot — the leftover of any Place flow that died before its
// cleanup, not just this flow's own anchor — takes the card instead (seen
// 2026-11-06: "Offline Test Place Updated" at ~0 m, left by an earlier batch,
// won the card and the anchor ended up hidden under "2 more nearby"). Those
// flows all pin to the same Paris fix, and a fixed name would not catch them
// all, so this clears the spot by distance, not by name.
//
// The radius is NEARBY_THRESHOLD_M from hooks/Place/useNearbyPlaces.ts: past
// it a place is never suggested, so there is nothing to gain from deleting it.
//
// Runs on the host, inside the Maestro JVM, like first-community-observation.js
// — the backend is localhost:8000 for both platforms. TEST_EMAIL /
// TEST_PASSWORD come from run.sh.
//
// Server-side only: the app's own place list is a react-query entry with a
// one-day staleTime, so a deletion here does not reach a list that is already
// cached. The flows that call this create a place right after, and that
// create invalidates the list — which is what makes the deletion visible.
var base = "http://localhost:8000";
var RADIUS_M = 500;

var fixLat = parseFloat(FIX_LAT);
var fixLng = parseFloat(FIX_LNG);
if (isNaN(fixLat) || isNaN(fixLng)) {
  throw new Error("clear-places-at-fix.js needs FIX_LAT and FIX_LNG");
}

var login = http.post(base + "/api-auth/login/", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
});
if (login.status !== 200) {
  throw new Error("API login failed: HTTP " + login.status);
}
var auth = { Authorization: "Bearer " + json(login.body).access };

function distanceM(lat1, lng1, lat2, lng2) {
  var rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad;
  var dLng = (lng2 - lng1) * rad;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Collect first, delete after: deleting while paging would shift the pages
// under the loop and skip places.
var doomed = [];
var page = 1;
while (page) {
  var res = http.get(base + "/myapi/place2/?per_page=100&page=" + page, {
    headers: auth,
  });
  if (res.status !== 200) {
    throw new Error("place2 list failed: HTTP " + res.status);
  }
  var body = json(res.body);
  var results = body.results || [];
  for (var i = 0; i < results.length; i++) {
    var coords = results[i].location && results[i].location.coordinates;
    if (!coords) continue;
    // GeoJSON order: [lng, lat].
    if (distanceM(fixLat, fixLng, coords[1], coords[0]) <= RADIUS_M) {
      doomed.push(results[i].id);
    }
  }
  page = body.pagination ? body.pagination.next : null;
}

for (var j = 0; j < doomed.length; j++) {
  var del = http.delete(base + "/myapi/place2/" + doomed[j] + "/", {
    headers: auth,
  });
  if (del.status !== 204 && del.status !== 404) {
    throw new Error("place2 delete " + doomed[j] + " failed: HTTP " + del.status);
  }
}

output.clearedPlaces = String(doomed.length);
