import type { Airport } from "./types";

/**
 * Aachen-Merzbrück (EDKA), Germany.
 *
 * Runway heading, coordinates, TORA/LDA, elevation and AFIS frequency were
 * cross-checked against a Jeppesen/Navigraph airport chart (09 Dec 22
 * revision) in addition to forschungsflugplatz.de/piloten and OpenAIP.
 *
 * ⚠️ That Jeppesen/Navigraph chart is explicitly licensed "for flight
 * simulation only — not for navigational use", so only the plain factual
 * numbers (which independently match the other two sources) were used
 * here — none of its printed procedural text is reproduced verbatim; the
 * `notes` below are paraphrased in different words, and are a convenience
 * summary, not a substitute for the real AIP entry. Always confirm current
 * figures against the official German eAIP (aip.dfs.de) before flying.
 */
export const EDKA: Airport = {
  icao: "EDKA",
  name: "Aachen-Merzbrück",
  country: "Germany",
  coordinates: { lat: 50.8217, lon: 6.185 },
  elevationFt: 623,
  magneticVariationDeg: 3, // East
  patternAltitudeFt: 1500,
  // EDKA has no official ICAO weather station, but a privately-run on-field
  // AWS at wetter-edka.de provides real current-conditions readings. TAF
  // (forecast) still comes from the nearest official station, Maastricht
  // Aachen (EHBK, ~16 NM WNW), since the local station is observation-only.
  weatherStationIcao: "EHBK",
  weatherStationNote: "Current conditions: wetter-edka.de (on-field, unofficial). Forecast (TAF): nearest official station, Maastricht Aachen (EHBK), ~16 NM away.",
  localMetarSource: "wetter-edka",
  runways: [
    {
      ident: "07/25",
      headingsMagDeg: [66, 246],
      lengthM: 1160,
      widthM: 18,
      surface: "asphalt",
      toraLdaM: 947,
    },
  ],
  frequencies: [{ label: "Aachen Info (AFIS)", mhz: 122.88 }],
  notamSource: {
    status: "unconfigured",
    briefingUrl: "https://www.ead.eurocontrol.int/",
    note: "Hosted mode only — see src/app/api/notams and src/lib/dfs-notams.ts.",
  },
  notes: [
    "Call Aachen Info at least 5 minutes before reaching the field; maintain a listening watch within the AD traffic area.",
    "Report entering the circuit and turning onto base, even without being prompted — full circles on base aren't permitted.",
    "Go-arounds are flown offset to the north, then rejoin the normal circuit.",
    "Asphalt and grass runway operations are never run simultaneously.",
    "Powered aircraft may not take off while the yellow flashing lights are on; use caution around helicopter wake turbulence.",
    "Max weight 3t MTOM (PPR above that up to 5.7t for helicopters).",
  ],
  sourceNote:
    "forschungsflugplatz.de/piloten, OpenAIP, and a Jeppesen/Navigraph chart (09 Dec 2022 revision, sim-only license — see caveat above), retrieved 2026-10-03. Verify against the current eAIP Germany before flight.",
};
