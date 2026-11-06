// Puts the id and species of some community observation into
// output.communityId / output.communitySpecies, so a flow can open a
// `my/community/<id>/` link without hard-coding an id from one database.
//
// Community records, not the account's own: own places and observations are
// wiped by reset-state.sh, so after `--reset` there would be nothing to link
// to, while the community feed is the whole local database (thousands of
// records) and does not depend on what the test account holds. Both kinds of
// link go through the same branch of linking.ts.
//
// Runs on the host, inside the Maestro JVM — not on the device — so the
// backend is localhost:8000 for both platforms, the same local backend
// reset-state.sh talks to. TEST_EMAIL / TEST_PASSWORD come from run.sh.
var base = "http://localhost:8000";

var login = http.post(base + "/api-auth/login/", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
});
if (login.status !== 200) {
  throw new Error("API login failed: HTTP " + login.status);
}
var access = json(login.body).access;

var list = http.get(base + "/myapi/community2/?per_page=1", {
  headers: { Authorization: "Bearer " + access },
});
if (list.status !== 200) {
  throw new Error("community2 list failed: HTTP " + list.status);
}
var results = json(list.body).results;
if (!results || results.length === 0) {
  throw new Error("community2 returned no observations to link to");
}

output.communityId = String(results[0].id);
// The English name: every flow runs with the interface in English
// (common/ensure-english.yaml), and the detail screen shows this one.
output.communitySpecies = results[0].species_data.name_lang;
