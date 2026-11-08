// Reads or checks what the backend serves the test account for the observations
// seeded by moderation-report-block.pre.sh, which are told apart by their notes.
//
//   read  — puts their ids and the author's profile id into output.feed;
//   check — throws unless exactly the letters in EXPECTED_FEED ("BC") are still
//           in the feed and the author's block state matches EXPECTED_BLOCKED
//           ("true" / "false").
//
// The feed is filtered server-side, and the app's list can lag behind it or be
// served from the offline cache, so "gone from the screen" alone would not
// prove the report or the block was stored.
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

  var res = http.get(base + "/myapi/community2/?o=-date_time&per_page=20", {
    headers: headers,
  });
  if (res.status !== 200) {
    throw new Error("community2 failed: HTTP " + res.status);
  }

  var seeded = {};
  json(res.body).results.forEach(function (row) {
    var match = /^E2E feed ([ABC])$/.exec(row.notes || "");
    if (match) seeded[match[1]] = row;
  });

  if (ACTION === "read") {
    if (!seeded.A || !seeded.B || !seeded.C) {
      throw new Error("seeded observations are not at the top of the feed");
    }
    output.feed = {
      a: String(seeded.A.id),
      b: String(seeded.B.id),
      c: String(seeded.C.id),
      author: String(seeded.A.owner.id),
    };
    return;
  }

  if (ACTION !== "check") {
    throw new Error("moderation-feed-state.js: unknown ACTION '" + ACTION + "'");
  }

  var inFeed = Object.keys(seeded).sort().join("");
  if (inFeed !== EXPECTED_FEED) {
    throw new Error("server feed has '" + inFeed + "', expected '" + EXPECTED_FEED + "'");
  }

  var blocks = http.get(base + "/myapi/blocks/?per_page=100", { headers: headers });
  if (blocks.status !== 200) {
    throw new Error("blocks failed: HTTP " + blocks.status);
  }
  var body = json(blocks.body);
  var blocked = (body.results || body).some(function (row) {
    return String(row.blocked) === output.feed.author;
  });
  if (String(blocked) !== EXPECTED_BLOCKED) {
    throw new Error("author blocked is " + blocked + ", expected " + EXPECTED_BLOCKED);
  }
})();
