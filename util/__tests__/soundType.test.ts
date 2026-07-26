import { soundTypeParts } from "../soundType";

it("maps every tag of a multi-tag type onto its own key", () => {
  expect(soundTypeParts("call, female, male")).toEqual([
    { key: "sound_type_call", raw: "call", uncertain: false },
    { key: "sound_type_female", raw: "female", uncertain: false },
    { key: "sound_type_male", raw: "male", uncertain: false },
  ]);
});

it("keeps an unknown tag as recorded instead of dropping it", () => {
  expect(soundTypeParts("song, st1 male song")).toEqual([
    { key: "sound_type_song", raw: "song", uncertain: false },
    { key: null, raw: "st1 male song", uncertain: false },
  ]);
});

it("recognises a tag the recordist marked as a guess", () => {
  expect(soundTypeParts("song?")).toEqual([
    { key: "sound_type_song", raw: "song", uncertain: true },
  ]);
});

it("recognises tags whatever case, quoting or padding they came in", () => {
  expect(soundTypeParts(' "Subsong" ,  Flight Call, song:')).toEqual([
    { key: "sound_type_subsong", raw: "Subsong", uncertain: false },
    { key: "sound_type_flight_call", raw: "Flight Call", uncertain: false },
    { key: "sound_type_song", raw: "song", uncertain: false },
  ]);
});

it("reads a lone question mark as the unknown tag, not as a guess", () => {
  expect(soundTypeParts("?")).toEqual([
    { key: "sound_type_unknown", raw: "?", uncertain: false },
  ]);
});

it("calls an empty or missing type unknown rather than showing a blank line", () => {
  const unknown = [{ key: "sound_type_unknown", raw: "", uncertain: false }];

  expect(soundTypeParts("")).toEqual(unknown);
  expect(soundTypeParts(null)).toEqual(unknown);
  expect(soundTypeParts(undefined)).toEqual(unknown);
  expect(soundTypeParts(" , ")).toEqual(unknown);
});
