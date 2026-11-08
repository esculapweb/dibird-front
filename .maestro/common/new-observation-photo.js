// Checks on the backend what became of the observation created by
// offline-observation-photo.yaml. "New" means an id above the newest one seen
// at the start of the flow, which needs no marker on the record itself.
// ACTION picks what it does:
//
//   read    — remembers the account's newest observation id in
//             output.photoFlowMaxId;
//   none    — throws if a new observation exists (proves the device really
//             was offline, see the wifi note in RELEASE_CHECKLIST.md §1);
//   photo   — throws unless there is exactly one new observation holding
//             exactly one stored photo;
//   cleanup — deletes the new observations; a no-op when `read` never ran, so
//             a cleanup from onFlowComplete cannot touch older records.
//
// Why the server and not the app: until it is uploaded the photo is drawn from
// its local file, so the strip looks the same whether or not it ever left the
// device.
//
// Runs on the host, inside the Maestro JVM, like profile-first-name.js.
var base = "http://localhost:8000";

(function () {
  var login = http.post(base + "/api-auth/login/", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (login.status !== 200) {
    throw new Error("API login failed: HTTP " + login.status);
  }
  var headers = { Authorization: "Bearer " + json(login.body).access };

  // -created_at: the endpoint rejects `o=-id` with a 400.
  var res = http.get(base + "/myapi/observation2/?o=-created_at&per_page=20", {
    headers: headers,
  });
  if (res.status !== 200) {
    throw new Error("observation2 failed: HTTP " + res.status);
  }
  var rows = json(res.body).results;

  if (ACTION === "read") {
    output.photoFlowMaxId = rows.reduce(function (max, row) {
      return Math.max(max, row.id);
    }, 0);
    return;
  }

  if (output.photoFlowMaxId === undefined) {
    if (ACTION === "cleanup") return;
    throw new Error("new-observation-photo.js: ACTION 'read' never ran");
  }

  var fresh = rows.filter(function (row) {
    return row.id > output.photoFlowMaxId;
  });

  if (ACTION === "none") {
    if (fresh.length !== 0) {
      throw new Error("observation " + fresh[0].id + " reached the server while offline");
    }
  } else if (ACTION === "photo") {
    if (fresh.length !== 1) {
      throw new Error("expected 1 new observation, found " + fresh.length);
    }
    var photos = fresh[0].photos || [];
    if (photos.length !== 1 || !photos[0].image) {
      throw new Error("expected 1 stored photo, found " + JSON.stringify(photos));
    }
  } else if (ACTION === "cleanup") {
    fresh.forEach(function (row) {
      var del = http.request(base + "/myapi/observation2/" + row.id + "/", {
        method: "DELETE",
        headers: headers,
      });
      if (del.status !== 204) {
        throw new Error("delete " + row.id + " failed: HTTP " + del.status);
      }
    });
  } else {
    throw new Error("new-observation-photo.js: unknown ACTION '" + ACTION + "'");
  }
})();
