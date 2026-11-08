// Throws unless the backend's unread notification count for the test account
// is EXPECTED, for offline-notifications-mark-all.yaml.
//
// Why the server and not the app: a mark-all made offline lives in a durable
// local overlay (notificationRepository.applyOverlay), so the app shows
// everything as read whether or not the queued mutation was ever sent.
//
// Runs on the host, inside the Maestro JVM, like profile-first-name.js — the
// host keeps its network while the emulator is in airplane mode, which is what
// lets the flow prove the mutation has NOT reached the server yet.
var base = "http://localhost:8000";

(function () {
  var login = http.post(base + "/api-auth/login/", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (login.status !== 200) {
    throw new Error("API login failed: HTTP " + login.status);
  }

  var res = http.get(base + "/myapi/notifications/unread-count/", {
    headers: { Authorization: "Bearer " + json(login.body).access },
  });
  if (res.status !== 200) {
    throw new Error("unread-count failed: HTTP " + res.status);
  }

  var count = json(res.body).count;
  if (String(count) !== String(EXPECTED)) {
    throw new Error("server unread count is " + count + ", expected " + EXPECTED);
  }
})();
