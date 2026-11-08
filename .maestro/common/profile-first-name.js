// Reads, checks or restores the test account's name fields straight on the
// backend, for offline-profile-edit.yaml. ACTION picks what it does:
//
//   read    — remembers first_name / last_name / username in
//             output.profileOrig;
//   expect  — throws unless the server's first_name is EXPECTED and the
//             other two are still the remembered ones (the flow edits one
//             field; a stray focus jump once typed into Username instead,
//             2026-11-07, and only the server shows that);
//   reject  — throws if the server's first_name is EXPECTED (proves the edit
//             has NOT reached it yet, i.e. the device really was offline);
//   restore — writes the remembered values back; a no-op when `read` never
//             ran (the flow died before it), so a cleanup from onFlowComplete
//             cannot overwrite the name with "undefined".
//
// Why the server and not the app: the profile lives in a Drizzle mirror
// (store/profile-context.tsx reads it with useLiveQuery), so after a relaunch
// the form shows the local edit whether or not it was ever pushed — the UI
// alone cannot tell a synced edit from one stuck in the mutation queue.
//
// Runs on the host, inside the Maestro JVM, like clear-places-at-fix.js — the
// backend is localhost:8000 and the host keeps its network while the
// emulator is in airplane mode. TEST_EMAIL / TEST_PASSWORD come from run.sh.
var base = "http://localhost:8000";

function authHeaders() {
  var login = http.post(base + "/api-auth/login/", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (login.status !== 200) {
    throw new Error("API login failed: HTTP " + login.status);
  }
  return {
    Authorization: "Bearer " + json(login.body).access,
    "Content-Type": "application/json",
  };
}

function serverUser(headers) {
  var res = http.get(base + "/myapi/profile/me/", { headers: headers });
  if (res.status !== 200) {
    throw new Error("profile/me failed: HTTP " + res.status);
  }
  return json(res.body).user_data;
}

function same(user, orig) {
  return (
    user.first_name === orig.first_name &&
    user.last_name === orig.last_name &&
    user.username === orig.username
  );
}

(function () {
  var headers = authHeaders();
  var orig = output.profileOrig;

  if (ACTION === "restore") {
    if (!orig) return;
    // All three fields, never just first_name: a stray focus jump can change
    // any of them (see `expect`). The read-back below stays because a 200
    // once proved nothing here: until Notion #487 a partial PATCH saved
    // nothing and still echoed the new value (2026-11-07: every
    // first_name-only restore "succeeded", and the next run read the previous
    // run's name as the original).
    var res = http.request(base + "/myapi/profile/me/", {
      method: "PATCH",
      headers: headers,
      body: JSON.stringify(orig),
    });
    if (res.status !== 200) {
      throw new Error("profile/me restore failed: HTTP " + res.status);
    }
    if (!same(serverUser(headers), orig)) {
      throw new Error("profile/me restore did not persist");
    }
    return;
  }

  var user = serverUser(headers);
  if (ACTION === "read") {
    output.profileOrig = {
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
    };
  } else if (ACTION === "expect") {
    if (user.first_name !== EXPECTED) {
      throw new Error(
        "server first_name is '" + user.first_name + "', expected '" +
          EXPECTED + "'",
      );
    }
    if (user.last_name !== orig.last_name || user.username !== orig.username) {
      throw new Error(
        "last_name/username changed: '" + user.last_name + "' / '" +
          user.username + "'",
      );
    }
  } else if (ACTION === "reject") {
    if (user.first_name === EXPECTED) {
      throw new Error(
        "server already has '" + EXPECTED + "' while the device is offline",
      );
    }
  } else {
    throw new Error("profile-first-name.js: unknown ACTION '" + ACTION + "'");
  }
})();
