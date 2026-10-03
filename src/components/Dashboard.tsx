"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Select } from "@/components/ui/Select";
import { WeatherPanel } from "@/components/WeatherPanel";
import { NotamPanel } from "@/components/NotamPanel";
import { AirportInfoPanel } from "@/components/AirportInfoPanel";
import { PerformanceCalculator } from "@/components/PerformanceCalculator";
import { AIRPORTS, DEFAULT_AIRPORT_ICAO } from "@/data/airports";
import { AIRCRAFT, DEFAULT_AIRCRAFT_ID } from "@/data/aircraft";

export function Dashboard() {
  const [airportIcao, setAirportIcao] = useState(DEFAULT_AIRPORT_ICAO);
  const [aircraftId, setAircraftId] = useState(DEFAULT_AIRCRAFT_ID);

  const airport = AIRPORTS[airportIcao];
  const aircraft = AIRCRAFT[aircraftId];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="instrument-frame flex h-10 w-10 items-center justify-center rounded-sm text-accent">
            <Plane size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">FlightPrep</h1>
            <p className="text-xs text-foreground-muted">Pre-flight weather, NOTAMs &amp; performance</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Select label="Airport" value={airportIcao} onChange={setAirportIcao}>
            {Object.values(AIRPORTS).map((a) => (
              <option key={a.icao} value={a.icao}>
                {a.icao} — {a.name}
              </option>
            ))}
          </Select>
          <Select label="Aircraft" value={aircraftId} onChange={setAircraftId}>
            {Object.values(AIRCRAFT).map((a) => (
              <option key={a.id} value={a.id}>
                {a.model}
              </option>
            ))}
          </Select>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WeatherPanel key={`weather-${airport.icao}`} airport={airport} />
        <NotamPanel key={`notam-${airport.icao}`} airport={airport} />
        <div className="lg:col-span-2">
          <AirportInfoPanel airport={airport} />
        </div>
        <div className="lg:col-span-2">
          <PerformanceCalculator airport={airport} aircraft={aircraft} />
        </div>
      </div>

      <footer className="pb-4 text-center text-[11px] text-foreground-muted">
        Flight preparation aid only — not a substitute for an official weather, NOTAM, or performance briefing.
      </footer>
    </div>
  );
}
