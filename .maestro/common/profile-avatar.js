// Clears or checks the test account's avatar on the backend, for
// offline-avatar.yaml. ACTION picks what it does:
//
//   clear   — removes the avatar, so the flow always starts without one;
//   none    — throws if the server has an avatar;
//   present — throws unless the server has one.
//
// Why the server and not the app: a queued change is drawn from the Drizzle
// mirror (pendingAvatarUri / pendingAvatarOp), so the header looks the same
// whether or not the change was ever sent.
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

  if (ACTION === "clear") {
    var del = http.request(base + "/myapi/profile/avatar/", {
      method: "DELETE",
      headers: headers,
    });
    if (del.status !== 204) {
      throw new Error("avatar delete failed: HTTP " + del.status);
    }
    return;
  }

  var res = http.get(base + "/myapi/profile/me/", { headers: headers });
  if (res.status !== 200) {
    throw new Error("profile/me failed: HTTP " + res.status);
  }
  var avatar = json(res.body).avatar;

  if (ACTION === "none") {
    if (avatar) throw new Error("server still has an avatar: " + avatar);
  } else if (ACTION === "present") {
    if (!avatar) throw new Error("server has no avatar");
  } else {
    throw new Error("profile-avatar.js: unknown ACTION '" + ACTION + "'");
  }
})();
