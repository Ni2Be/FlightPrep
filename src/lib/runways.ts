import type { Airport, RunwaySurface } from "@/data/airports/types";

export interface RunwayEnd {
  id: string; // e.g. "07"
  headingMagDeg: number;
  widthM: number;
  surface: RunwaySurface;
  distanceAvailableM: number;
}

/** Flattens each runway's two idents (e.g. "07/25") into separate landable/takeoff ends. */
export function runwayEnds(airport: Airport): RunwayEnd[] {
  const ends: RunwayEnd[] = [];
  for (const rw of airport.runways) {
    const idents = rw.ident.split("/");
    idents.forEach((id, i) => {
      ends.push({
        id,
        headingMagDeg: rw.headingsMagDeg[i] ?? rw.headingsMagDeg[0],
        widthM: rw.widthM,
        surface: rw.surface,
        distanceAvailableM: rw.toraLdaM ?? rw.lengthM,
      });
    });
  }
  return ends;
}
