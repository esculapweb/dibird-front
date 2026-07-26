// Xeno-canto's recording `type` is free text a recordist types in: a
// comma-separated list of tags ("call, male", "flight call, song"). Across the
// archive that makes ~3400 distinct strings, but they are built from a much
// smaller vocabulary — the tags below cover ~96% of our recordings. Everything
// else falls through to the original English, so an unknown tag still reads.
const SOUND_TYPE_KEYS: Record<string, string> = {
  song: "sound_type_song",
  songs: "sound_type_songs",
  // Recordists from Spanish- and Portuguese-speaking countries tag in their
  // own language often enough to be worth the two aliases.
  canto: "sound_type_song",
  chamado: "sound_type_call",
  call: "sound_type_call",
  calls: "sound_type_calls",
  voices: "sound_type_voices",

  "flight call": "sound_type_flight_call",
  "call flight": "sound_type_flight_call",
  "call in flight": "sound_type_flight_call",
  "flight calls": "sound_type_flight_calls",
  "calls in flight": "sound_type_flight_calls",
  "nocturnal flight call": "sound_type_nocturnal_flight_call",
  "alarm call": "sound_type_alarm_call",
  "alarm calls": "sound_type_alarm_calls",
  alarm: "sound_type_alarm",
  "begging call": "sound_type_begging_call",
  "begging calls": "sound_type_begging_calls",
  begging: "sound_type_begging",
  "contact call": "sound_type_contact_call",
  "contact calls": "sound_type_contact_calls",
  "contact notes": "sound_type_contact_notes",
  "feeding call": "sound_type_feeding_call",
  "feeding calls": "sound_type_feeding_calls",
  "foraging calls": "sound_type_foraging_calls",
  "interaction call": "sound_type_interaction_call",
  "interaction calls": "sound_type_interaction_calls",
  "chase call": "sound_type_chase_call",
  "chasing call": "sound_type_chase_call",
  "chase calls": "sound_type_chase_calls",
  "agitated call": "sound_type_agitated_call",
  "agitated calls": "sound_type_agitated_calls",
  "excited calls": "sound_type_excited_calls",
  "excitement call": "sound_type_excitement_call",
  "agitated song": "sound_type_agitated_song",
  "excited song": "sound_type_excited_song",
  "distress call": "sound_type_distress_call",
  scold: "sound_type_scold",
  "territorial call": "sound_type_territorial_call",
  "territorial song": "sound_type_territorial_song",
  "various calls": "sound_type_various_calls",
  "soft calls": "sound_type_soft_calls",
  "take-off call": "sound_type_take_off_call",
  "take-off calls": "sound_type_take_off_calls",
  "long call": "sound_type_long_call",
  "short call": "sound_type_short_call",

  display: "sound_type_display",
  "display call": "sound_type_display_call",
  "display calls": "sound_type_display_calls",
  "display song": "sound_type_display_song",
  "display flight": "sound_type_display_flight",
  "flight display": "sound_type_display_flight",
  lek: "sound_type_lek",
  lekking: "sound_type_lekking",
  "lek song": "sound_type_lek_song",
  "song at lek": "sound_type_lek_song",

  "dawn song": "sound_type_dawn_song",
  "dawn chorus": "sound_type_dawn_chorus",
  subsong: "sound_type_subsong",
  "long song": "sound_type_long_song",
  "short song": "sound_type_short_song",
  "alternate song": "sound_type_alternate_song",
  "complex song": "sound_type_complex_song",
  "partial song": "sound_type_partial_song",
  "half song": "sound_type_partial_song",
  "flight song": "sound_type_flight_song",
  "song flight": "sound_type_flight_song",
  "song in flight": "sound_type_flight_song",
  duet: "sound_type_duet",
  "duet song": "sound_type_duet_song",
  "song in duet": "sound_type_duet_song",
  chorus: "sound_type_chorus",
  "song and call": "sound_type_song_and_call",
  "call and song": "sound_type_call_and_song",
  "song and calls": "sound_type_song_and_calls",
  "calls or song": "sound_type_calls_or_song",
  "call or song": "sound_type_call_or_song",
  "call/song": "sound_type_call_or_song",
  "song or call": "sound_type_song_or_call",

  drumming: "sound_type_drumming",
  drum: "sound_type_drum",
  rattle: "sound_type_rattle",
  "rattle call": "sound_type_rattle_call",
  chatter: "sound_type_chatter",
  trill: "sound_type_trill",
  booming: "sound_type_booming",
  whistle: "sound_type_whistle",
  tapping: "sound_type_tapping",
  pecking: "sound_type_pecking",
  "bill clapping": "sound_type_bill_clapping",
  "bill clappering": "sound_type_bill_clapping",
  "bill snapping": "sound_type_bill_clapping",
  "bill clicking": "sound_type_bill_clapping",
  "bill snap": "sound_type_bill_snap",
  "bill snaps": "sound_type_bill_snap",
  "wing noise": "sound_type_wing_noise",
  "noise of wings": "sound_type_wing_noise",
  "wing sound": "sound_type_wing_noise",
  "wing sounds": "sound_type_wing_noise",
  wingbeats: "sound_type_wingbeats",
  "wing beats": "sound_type_wingbeats",
  "wing beat": "sound_type_wingbeats",
  "wing-beat": "sound_type_wingbeats",
  "wing flapping": "sound_type_wing_flapping",
  "wing flaps": "sound_type_wing_flapping",
  "wing whirr": "sound_type_wing_whirr",
  "wing whirrs": "sound_type_wing_whirr",
  "wing whirring": "sound_type_wing_whirr",
  "wing hum": "sound_type_wing_hum",
  hum: "sound_type_hum",
  "wing snap": "sound_type_wing_snap",
  "wing snaps": "sound_type_wing_snap",
  "wing flutter": "sound_type_wing_flutter",
  "echolocation calls": "sound_type_echolocation",
  "echo location": "sound_type_echolocation",

  mimicry: "sound_type_mimicry",
  imitation: "sound_type_mimicry",
  "mimicry/imitation": "sound_type_mimicry",
  aberrant: "sound_type_aberrant",
  "aberrant song": "sound_type_aberrant_song",
  perched: "sound_type_perched",
  "bird in hand": "sound_type_bird_in_hand",
  "human voice": "sound_type_human_voice",
  traffic: "sound_type_traffic",
  wind: "sound_type_wind",
  waves: "sound_type_waves",

  male: "sound_type_male",
  males: "sound_type_males",
  female: "sound_type_female",
  females: "sound_type_females",
  adult: "sound_type_adult",
  adults: "sound_type_adults",
  juvenile: "sound_type_juvenile",
  juveniles: "sound_type_juveniles",
  immature: "sound_type_immature",
  chick: "sound_type_chick",
  "hatchling or nestling": "sound_type_hatchling_or_nestling",
  pair: "sound_type_pair",
  "sex uncertain": "sound_type_sex_uncertain",
  "life stage uncertain": "sound_type_life_stage_uncertain",
  uncertain: "sound_type_uncertain",
  // A lone "?" is how ~0.5% of recordings say "no idea what this is".
  "?": "sound_type_unknown",
};

export interface SoundTypePart {
  // The locale key for a tag we know, null when it stays in the source English.
  key: string | null;
  // What to show when there is no key — the tag as recorded, minus the
  // punctuation stripped below.
  raw: string;
  // The recordist marked the tag as a guess ("song?").
  uncertain: boolean;
}

// Splits a recording's `type` into the tags it is made of and maps each onto a
// locale key. Formatting stays with the caller, which has `t`.
export const soundTypeParts = (type?: string | null): SoundTypePart[] => {
  const parts = (type ?? "")
    .split(",")
    .map((tag) => tag.trim())
    // Tags come quoted ('"subsong"'), trailed by a colon ("song:") or by the
    // "?" that marks a guess ("song?") — none of that changes which tag it is.
    .map((tag) =>
      tag
        .replace(/^["']+/, "")
        .replace(/["':]+$/, "")
        .trim(),
    )
    .filter(Boolean)
    .map((tag) => {
      const known = SOUND_TYPE_KEYS[tag.toLowerCase()];
      if (known) return { key: known, raw: tag, uncertain: false };
      const uncertain = /\?+$/.test(tag);
      const base = uncertain ? tag.replace(/\?+$/, "").trim() : tag;
      return {
        key: SOUND_TYPE_KEYS[base.toLowerCase()] ?? null,
        raw: base,
        uncertain,
      };
    })
    // "?" alone resolves above; "?" left over from an empty tag has nothing
    // behind it to qualify.
    .filter((part) => part.key !== null || part.raw !== "");

  // ~0.5% of recordings carry no type at all — same as the ones tagged "?",
  // and an empty line above the recordist reads as a bug rather than as
  // "nobody said what this is".
  if (parts.length === 0) {
    return [{ key: "sound_type_unknown", raw: "", uncertain: false }];
  }
  return parts;
};

// The keys SOUND_TYPE_KEYS resolves at runtime — i18next-parser only sees
// literal t() calls, so without this list `npm run i18n:extract` drops them.
// t("sound_type_song")
// t("sound_type_songs")
// t("sound_type_call")
// t("sound_type_calls")
// t("sound_type_voices")
// t("sound_type_flight_call")
// t("sound_type_flight_calls")
// t("sound_type_nocturnal_flight_call")
// t("sound_type_alarm_call")
// t("sound_type_alarm_calls")
// t("sound_type_alarm")
// t("sound_type_begging_call")
// t("sound_type_begging_calls")
// t("sound_type_begging")
// t("sound_type_contact_call")
// t("sound_type_contact_calls")
// t("sound_type_contact_notes")
// t("sound_type_feeding_call")
// t("sound_type_feeding_calls")
// t("sound_type_foraging_calls")
// t("sound_type_interaction_call")
// t("sound_type_interaction_calls")
// t("sound_type_chase_call")
// t("sound_type_chase_calls")
// t("sound_type_agitated_call")
// t("sound_type_agitated_calls")
// t("sound_type_excited_calls")
// t("sound_type_excitement_call")
// t("sound_type_agitated_song")
// t("sound_type_excited_song")
// t("sound_type_distress_call")
// t("sound_type_scold")
// t("sound_type_territorial_call")
// t("sound_type_territorial_song")
// t("sound_type_various_calls")
// t("sound_type_soft_calls")
// t("sound_type_take_off_call")
// t("sound_type_take_off_calls")
// t("sound_type_long_call")
// t("sound_type_short_call")
// t("sound_type_display")
// t("sound_type_display_call")
// t("sound_type_display_calls")
// t("sound_type_display_song")
// t("sound_type_display_flight")
// t("sound_type_lek")
// t("sound_type_lekking")
// t("sound_type_lek_song")
// t("sound_type_dawn_song")
// t("sound_type_dawn_chorus")
// t("sound_type_subsong")
// t("sound_type_long_song")
// t("sound_type_short_song")
// t("sound_type_alternate_song")
// t("sound_type_complex_song")
// t("sound_type_partial_song")
// t("sound_type_flight_song")
// t("sound_type_duet")
// t("sound_type_duet_song")
// t("sound_type_chorus")
// t("sound_type_song_and_call")
// t("sound_type_call_and_song")
// t("sound_type_song_and_calls")
// t("sound_type_calls_or_song")
// t("sound_type_call_or_song")
// t("sound_type_song_or_call")
// t("sound_type_drumming")
// t("sound_type_drum")
// t("sound_type_rattle")
// t("sound_type_rattle_call")
// t("sound_type_chatter")
// t("sound_type_trill")
// t("sound_type_booming")
// t("sound_type_whistle")
// t("sound_type_tapping")
// t("sound_type_pecking")
// t("sound_type_bill_clapping")
// t("sound_type_bill_snap")
// t("sound_type_wing_noise")
// t("sound_type_wingbeats")
// t("sound_type_wing_flapping")
// t("sound_type_wing_whirr")
// t("sound_type_wing_hum")
// t("sound_type_hum")
// t("sound_type_wing_snap")
// t("sound_type_wing_flutter")
// t("sound_type_echolocation")
// t("sound_type_mimicry")
// t("sound_type_aberrant")
// t("sound_type_aberrant_song")
// t("sound_type_perched")
// t("sound_type_bird_in_hand")
// t("sound_type_human_voice")
// t("sound_type_traffic")
// t("sound_type_wind")
// t("sound_type_waves")
// t("sound_type_male")
// t("sound_type_males")
// t("sound_type_female")
// t("sound_type_females")
// t("sound_type_adult")
// t("sound_type_adults")
// t("sound_type_juvenile")
// t("sound_type_juveniles")
// t("sound_type_immature")
// t("sound_type_chick")
// t("sound_type_hatchling_or_nestling")
// t("sound_type_pair")
// t("sound_type_sex_uncertain")
// t("sound_type_life_stage_uncertain")
// t("sound_type_uncertain")
// t("sound_type_unknown")
