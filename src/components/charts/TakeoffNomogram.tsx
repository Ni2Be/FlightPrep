"use client";

import { useRef, useState } from "react";
import { HOSTED_MODE, referenceChartUrl } from "@/lib/data-paths";
import {
  TAKEOFF,
  DEFAULT_TAKEOFF_CALIBRATION,
  MASS_ANCHOR_TOLERANCE_KG,
  WIND_ANCHOR_TOLERANCE_KT,
  massAdjustedDistanceM,
  referenceDistanceM,
  windAdjustedTakeoffDistanceM,
  type WindDirection,
} from "@/lib/aircraft-performance/pa28-161-cadet";
import {
  scaleValueToPx,
  scalePxToValue,
  withAxisPx,
  withLinePoint,
  withAddedLinePoint,
  withRemovedLinePoint,
  withMassPoint,
  withRemovedMassPoint,
  withWindPoint,
  withRemovedWindPoint,
  type TakeoffCalibration,
  type TakeoffAxisName,
} from "@/lib/aircraft-performance/calibration";

type Selection = { kind: "temp"; pressureFt: number } | { kind: "mass" } | { kind: "wind"; direction: WindDirection };

function pathD(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}

const PRESSURE_FAMILIES = [0, 1000, 2000, 3000, 4000, 5000, 6000];
const MASS_FAMILIES = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800];

// Where each axis's two drag handles sit on the "other" (fixed) coordinate —
// purely a visual placement choice, independent of the axis's own px range.
const AXIS_HANDLE_CROSS_PX: Record<TakeoffAxisName, number> = { temp: 765, mass: 765, wind: 765, distance: 22 };
const AXIS_HANDLES: { axis: TakeoffAxisName; which: "pxA" | "pxB"; horizontal: boolean }[] = [
  { axis: "temp", which: "pxA", horizontal: true },
  { axis: "temp", which: "pxB", horizontal: true },
  { axis: "mass", which: "pxA", horizontal: true },
  { axis: "mass", which: "pxB", horizontal: true },
  { axis: "wind", which: "pxA", horizontal: true },
  { axis: "wind", which: "pxB", horizontal: true },
  { axis: "distance", which: "pxA", horizontal: false },
  { axis: "distance", which: "pxB", horizontal: false },
];

export function TakeoffNomogram({
  pressureFt,
  tempC,
  massKg,
  windKt,
  direction,
  speedKias,
  calibration = DEFAULT_TAKEOFF_CALIBRATION,
  editable = false,
  onCalibrationChange,
}: {
  pressureFt: number;
  tempC: number;
  massKg: number;
  windKt: number;
  direction: WindDirection;
  speedKias: number;
  calibration?: TakeoffCalibration;
  editable?: boolean;
  onCalibrationChange?: (next: TakeoffCalibration) => void;
}) {
  const [showScan, setShowScan] = useState(editable);
  const [showGrid, setShowGrid] = useState(true);
  const [showFamilies, setShowFamilies] = useState(true);
  const [scanMissing, setScanMissing] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "temp", pressureFt: 3000 });
  const svgRef = useRef<SVGSVGElement>(null);

  const sxTemp = scaleValueToPx(calibration.axes.temp);
  const sxMass = scaleValueToPx(calibration.axes.mass);
  const sxWind = scaleValueToPx(calibration.axes.wind);
  const sy = scaleValueToPx(calibration.axes.distance);
  const pxToTemp = scalePxToValue(calibration.axes.temp);
  const pxToMass = scalePxToValue(calibration.axes.mass);
  const pxToWind = scalePxToValue(calibration.axes.wind);
  const pxToDistance = scalePxToValue(calibration.axes.distance);

  const tempPx = [sxTemp(TAKEOFF.minTempC), sxTemp(TAKEOFF.maxTempC)];
  const distPx = [sy(0), sy(TAKEOFF.fullScaleM)];
  const massPx = [sxMass(TAKEOFF.refMassKg), sxMass(TAKEOFF.minMassKg)];
  const windPx = [sxWind(0), sxWind(15)];
  const PANEL1 = { x: Math.min(...tempPx), y: Math.min(...distPx), width: Math.abs(tempPx[1] - tempPx[0]), height: Math.abs(distPx[1] - distPx[0]) };
  const PANEL2 = { x: Math.min(...massPx), y: Math.min(...distPx), width: Math.abs(massPx[1] - massPx[0]), height: Math.abs(distPx[1] - distPx[0]) };
  const PANEL3 = { x: Math.min(...windPx), y: Math.min(...distPx), width: Math.abs(windPx[1] - windPx[0]), height: Math.abs(distPx[1] - distPx[0]) };
  const yTop = Math.min(...distPx);
  const yBottom = Math.max(...distPx);

  const xT = sxTemp(tempC);
  const xM = sxMass(massKg);
  const xW = sxWind(windKt);
  const d1 = referenceDistanceM(pressureFt, tempC, calibration);
  const d2 = massAdjustedDistanceM(d1, massKg, calibration);
  const d3 = windAdjustedTakeoffDistanceM(d2, windKt, speedKias, direction, calibration);
  const y1 = sy(d1);
  const y2 = sy(d2);
  const y3 = sy(d3);
  const offChart = d1 > TAKEOFF.fullScaleM || d2 > TAKEOFF.fullScaleM || d3 > TAKEOFF.fullScaleM;

  const massPts: [number, number][] = Array.from({ length: 61 }, (_, i) => {
    const mm = TAKEOFF.refMassKg + (massKg - TAKEOFF.refMassKg) * (i / 60);
    return [sxMass(mm), sy(massAdjustedDistanceM(d1, mm, calibration))];
  });
  const windPts: [number, number][] = Array.from({ length: 61 }, (_, i) => {
    const ww = (windKt * i) / 60;
    return [sxWind(ww), sy(windAdjustedTakeoffDistanceM(d2, ww, speedKias, direction, calibration))];
  });

  function toSvgPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  const selectedLineData = selection.kind === "temp" ? calibration.lines.find((l) => l.pressureFt === selection.pressureFt) : undefined;

  const scanVisible = showScan && !scanMissing;
  const vectorVisible = editable || !scanVisible;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-sm border border-panel-border bg-white">
        <svg ref={svgRef} viewBox="0 0 1203 855" width="100%" style={{ minWidth: 640, display: "block" }} role="img" aria-label="Takeoff ground roll nomogram">
          <defs>
            <clipPath id="to-panel1">
              <rect {...PANEL1} />
            </clipPath>
            <clipPath id="to-panel2">
              <rect {...PANEL2} />
            </clipPath>
            <clipPath id="to-panel3">
              <rect {...PANEL3} />
            </clipPath>
          </defs>

          <rect x={17} y={16} width={1160} height={823} fill="#fff" stroke="#cbd5e1" />

          {scanVisible && (
            <image
              href={referenceChartUrl("pa28-161-cadet-takeoff")}
              x={0}
              y={0}
              width={1203}
              height={855}
              preserveAspectRatio="none"
              opacity={editable ? 0.75 : 0.95}
              onError={() => setScanMissing(true)}
            />
          )}

          {vectorVisible && (
            <g>
              {!scanVisible && (
                <g>
                  <text x={607} y={41} textAnchor="middle" fontSize={17} fontWeight={700} fill="#172b46">
                    STARTLAUFSTRECKE BEI 0°-KLAPPENSTELLUNG
                  </text>
                  <text x={607} y={61} textAnchor="middle" fontSize={11} fill="#41536e">
                    Befestigte, ebene, trockene Startbahn · Vollgas vor Freigabe der Bremsen
                  </text>
                  <text x={202} y={116} textAnchor="middle" fontSize={14} fontWeight={700} fill="#172b46">
                    1 DRUCKHÖHE + TEMPERATUR
                  </text>
                  <text x={685} y={116} textAnchor="middle" fontSize={14} fontWeight={700} fill="#172b46">
                    2 MASSENKORREKTUR
                  </text>
                  <text x={962} y={116} textAnchor="middle" fontSize={14} fontWeight={700} fill="#172b46">
                    3 WIND
                  </text>
                </g>
              )}

              {showGrid && (
                <g stroke="#dfe6ef">
                  {Array.from({ length: 81 }, (_, i) => i * 10).map((d) => (
                    <g key={`gy-${d}`}>
                      {[PANEL1, PANEL2, PANEL3].map((panel, pi) => (
                        <line
                          key={pi}
                          x1={panel.x}
                          x2={panel.x + panel.width}
                          y1={sy(d)}
                          y2={sy(d)}
                          strokeWidth={d % 100 === 0 ? 0.8 : 0.5}
                          opacity={d % 100 === 0 ? 0.9 : 0.5}
                        />
                      ))}
                    </g>
                  ))}
                  {Array.from({ length: 41 }, (_, i) => -40 + i * 2).map((t) => (
                    <line key={`gt-${t}`} x1={sxTemp(t)} x2={sxTemp(t)} y1={yTop} y2={yBottom} strokeWidth={t % 10 === 0 ? 0.8 : 0.5} />
                  ))}
                  {Array.from({ length: 34 }, (_, i) => 725 + i * 10).map((m) => (
                    <line key={`gm-${m}`} x1={sxMass(m)} x2={sxMass(m)} y1={yTop} y2={yBottom} strokeWidth={m % 50 === 0 ? 0.8 : 0.5} />
                  ))}
                  {Array.from({ length: 16 }, (_, i) => i).map((w) => (
                    <line key={`gw-${w}`} x1={sxWind(w)} x2={sxWind(w)} y1={yTop} y2={yBottom} strokeWidth={w % 5 === 0 ? 0.8 : 0.5} />
                  ))}
                </g>
              )}

              {showFamilies && (
                <g>
                  {PRESSURE_FAMILIES.map((p) => {
                    const pts: [number, number][] = [];
                    for (let t = -40; t <= 40; t += 0.5) pts.push([sxTemp(t), sy(referenceDistanceM(p, t, calibration))]);
                    const major = p % 2000 === 0;
                    const isSelected = editable && selection.kind === "temp" && p === selection.pressureFt;
                    return (
                      <g key={`pf-${p}`}>
                        <path
                          d={pathD(pts)}
                          stroke={isSelected ? "var(--accent)" : "#3d526e"}
                          fill="none"
                          strokeWidth={isSelected ? 3 : major ? 2 : 1}
                          opacity={isSelected ? 1 : major ? 1 : 0.45}
                          clipPath="url(#to-panel1)"
                        />
                        {major && (
                          <text
                            x={sxTemp(-19)}
                            y={sy(referenceDistanceM(p, -19, calibration)) - 7}
                            fontSize={10}
                            fill="#41536e"
                            transform={`rotate(-23 ${sxTemp(-19)} ${sy(referenceDistanceM(p, -19, calibration)) - 7})`}
                          >
                            {p} ft
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {!editable &&
                    (() => {
                      const pts: [number, number][] = [];
                      for (let p = 0; p <= 6000; p += 100) {
                        const isa = 15 - (2 * p) / 1000;
                        pts.push([sxTemp(isa), sy(referenceDistanceM(p, isa, calibration))]);
                      }
                      return <path d={pathD(pts)} stroke="#253950" fill="none" strokeWidth={1.8} strokeDasharray="5 4" clipPath="url(#to-panel1)" />;
                    })()}

                  {MASS_FAMILIES.map((d) => {
                    const pts: [number, number][] = [];
                    for (let m = TAKEOFF.refMassKg; m >= TAKEOFF.minMassKg; m -= 3) pts.push([sxMass(m), sy(massAdjustedDistanceM(d, m, calibration))]);
                    pts.push([sxMass(TAKEOFF.minMassKg), sy(massAdjustedDistanceM(d, TAKEOFF.minMassKg, calibration))]);
                    const major = d % 100 === 0;
                    const isSelected = editable && selection.kind === "mass" && d === calibration.mass.referenceD;
                    return (
                      <path
                        key={`mf-${d}`}
                        d={pathD(pts)}
                        stroke={isSelected ? "var(--accent)" : "#3d526e"}
                        fill="none"
                        strokeWidth={isSelected ? 3 : major ? 1.6 : 0.9}
                        opacity={isSelected ? 1 : major ? 1 : 0.45}
                        clipPath="url(#to-panel2)"
                      />
                    );
                  })}

                  {MASS_FAMILIES.map((d) =>
                    (["head", "tail"] as const).map((dir) => {
                      const pts: [number, number][] = [];
                      for (let w = 0; w <= 15; w += 0.3) pts.push([sxWind(w), sy(windAdjustedTakeoffDistanceM(d, w, speedKias, dir, calibration))]);
                      const major = d % 100 === 0;
                      const isSelected = editable && selection.kind === "wind" && selection.direction === dir && d === calibration.wind.referenceD;
                      return (
                        <path
                          key={`wf-${d}-${dir}`}
                          d={pathD(pts)}
                          stroke={isSelected ? "var(--accent)" : "#3d526e"}
                          fill="none"
                          strokeWidth={isSelected ? 3 : dir === "tail" ? 0.8 : major ? 1.6 : 0.9}
                          strokeDasharray={dir === "tail" && !isSelected ? "4 4" : undefined}
                          opacity={isSelected ? 1 : dir === "tail" ? 0.25 : major ? 1 : 0.4}
                          clipPath="url(#to-panel3)"
                        />
                      );
                    }),
                  )}
                </g>
              )}

              {!scanVisible && (
                <g>
                  {/* panel frames */}
                  {[PANEL1, PANEL2, PANEL3].map((panel, i) => (
                    <rect key={i} x={panel.x} y={panel.y} width={panel.width} height={panel.height} fill="none" stroke="#26384f" strokeWidth={1.4} />
                  ))}

                  {/* axes */}
                  {Array.from({ length: 9 }, (_, i) => -40 + i * 10).map((t) => (
                    <g key={`at-${t}`}>
                      <line x1={sxTemp(t)} x2={sxTemp(t)} y1={yBottom} y2={yBottom + 7} stroke="#26384f" />
                      <text x={sxTemp(t)} y={yBottom + 21} textAnchor="middle" fontSize={11} fill="#445970">
                        {t}
                      </text>
                    </g>
                  ))}
                  <text x={215} y={812} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    Außenlufttemperatur in °C
                  </text>
                  {[2325, 2200, 2000, 1800, 1600].map((lb) => {
                    const kg = Math.min(1055, Math.max(725, lb / 2.2046226218));
                    return (
                      <g key={`am-${lb}`}>
                        <line x1={sxMass(kg)} x2={sxMass(kg)} y1={yBottom} y2={yBottom + 8} stroke="#26384f" />
                        <text x={sxMass(kg)} y={yBottom + 21} textAnchor="middle" fontSize={11} fill="#445970">
                          {lb}
                        </text>
                      </g>
                    );
                  })}
                  <text x={685} y={813} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    Masse in lb (oben: Abhebegeschwindigkeit)
                  </text>
                  {Array.from({ length: 6 }, (_, i) => 50 - i * 2).map((s) => {
                    const kg = Math.min(1055, Math.max(725, 1055 * Math.pow(s / 50, 1 / 0.6)));
                    return (
                      <text key={`as-${s}`} x={sxMass(kg)} y={yTop - 4} textAnchor="middle" fontSize={11} fill="#445970">
                        {s}
                      </text>
                    );
                  })}
                  <text x={607} y={yTop - 30} textAnchor="middle" fontSize={13} fontWeight={700} fill="#23364d">
                    Abhebegeschwindigkeit in KIAS
                  </text>
                  {[0, 5, 10, 15].map((w) => (
                    <g key={`aw-${w}`}>
                      <line x1={sxWind(w)} x2={sxWind(w)} y1={yBottom} y2={yBottom + 8} stroke="#26384f" />
                      <text x={sxWind(w)} y={yBottom + 21} textAnchor="middle" fontSize={11} fill="#445970">
                        {w}
                      </text>
                    </g>
                  ))}
                  <text x={962} y={813} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    Wind in kn
                  </text>

                  <line x1={1030} x2={1030} y1={yTop} y2={yBottom} stroke="#26384f" />
                  {Array.from({ length: 27 }, (_, i) => i * 100).map((f) => {
                    const yy = sy(f * 0.3048);
                    if (yy < yTop) return null;
                    return (
                      <g key={`ft-${f}`}>
                        <line x1={1030} x2={1030 + (f % 200 === 0 ? 12 : 6)} y1={yy} y2={yy} stroke="#26384f" />
                        {f % 400 === 0 && (
                          <text x={1050} y={yy + 4} fontSize={11} fill="#445970">
                            {f}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <text x={1043} y={155} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    ft
                  </text>
                  <line x1={1085} x2={1085} y1={yTop} y2={yBottom} stroke="#26384f" />
                  {Array.from({ length: 33 }, (_, i) => i * 25).map((m) => (
                    <g key={`mm-${m}`}>
                      <line x1={1085} x2={1085 + (m % 100 === 0 ? 22 : 8)} y1={sy(m)} y2={sy(m)} stroke="#26384f" />
                      {m % 100 === 0 && (
                        <text x={1115} y={sy(m) + 4} fontSize={11} fill="#445970">
                          {m}
                        </text>
                      )}
                    </g>
                  ))}
                  <text x={1099} y={155} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    m
                  </text>
                  <text x={1162} y={476} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d" transform="rotate(90 1162 476)">
                    Startlaufstrecke
                  </text>
                </g>
              )}
            </g>
          )}

          {/* trace — always on top, even over the scan */}
          {!offChart && !editable && (
            <g>
              <g stroke="#d72540" strokeWidth={1.5} strokeDasharray="5 4" fill="none" opacity={0.75}>
                <path d={pathD([[xT, yBottom], [xT, y1]])} />
                <path d={pathD([[PANEL1.x, y1], [xT, y1]])} opacity={0.55} />
                <path d={pathD([[xM, yBottom], [xM, y2]])} />
                <path d={pathD([[xW, yBottom], [xW, y3]])} />
                <path d={pathD([[1030, y3], [1085, y3]])} opacity={0.85} />
              </g>
              <g stroke="#d72540" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={pathD([[xT, y1], [PANEL2.x, y1]])} />
                <path d={pathD(massPts)} />
                <path d={pathD([[xM, y2], [PANEL3.x, y2]])} />
                <path d={pathD(windPts)} />
                <path d={pathD([[xW, y3], [1085, y3]])} />
              </g>
              {[[xT, y1], [PANEL2.x, y1], [xM, y2], [PANEL3.x, y2], [xW, y3], [1085, y3]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={4.5} fill="#d72540" stroke="#fff" strokeWidth={2} />
              ))}
              <text x={Math.min(xT + 10, 360)} y={y1 - 11} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                1
              </text>
              <text x={Math.min(xM + 10, 828)} y={y2 - 11} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                2
              </text>
              <text x={Math.min(xW + 9, 1008)} y={y3 - 12} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                3
              </text>
              <text x={1102} y={y3 - 8} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                {Math.round(d3)} m
              </text>
            </g>
          )}

          {/* calibration editor overlay */}
          {editable && onCalibrationChange && (
            <g>
              {AXIS_HANDLES.map(({ axis, which, horizontal }, i) => {
                const px = which === "pxA" ? calibration.axes[axis].pxA : calibration.axes[axis].pxB;
                const cross = AXIS_HANDLE_CROSS_PX[axis];
                const cx = horizontal ? px : cross;
                const cy = horizontal ? cross : px;
                return (
                  <rect
                    key={`axis-${axis}-${which}`}
                    x={cx - 6}
                    y={cy - 6}
                    width={12}
                    height={12}
                    fill="#0ea5e9"
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ cursor: horizontal ? "ew-resize" : "ns-resize", touchAction: "none" }}
                    onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                    onPointerMove={(e) => {
                      if (e.buttons !== 1) return;
                      const p = toSvgPoint(e);
                      onCalibrationChange(withAxisPx(calibration, axis, which, horizontal ? p.x : p.y));
                    }}
                  >
                    <title>
                      {axis} axis, {which === "pxA" ? "start" : "end"} anchor ({i})
                    </title>
                  </rect>
                );
              })}

              {/* click-to-add rects FIRST so the point handles below (rendered on top) get drag priority */}
              {selection.kind === "temp" && (
                <rect
                  x={PANEL1.x}
                  y={PANEL1.y}
                  width={PANEL1.width}
                  height={PANEL1.height}
                  fill="transparent"
                  style={{ cursor: "copy" }}
                  onClick={(e) => {
                    const p = toSvgPoint(e);
                    onCalibrationChange(withAddedLinePoint(calibration, selection.pressureFt, { tempC: pxToTemp(p.x), distanceM: pxToDistance(p.y) }));
                  }}
                >
                  <title>Click to add a point to the {selection.pressureFt} ft line</title>
                </rect>
              )}
              {selection.kind === "mass" && (
                <rect
                  x={PANEL2.x}
                  y={PANEL2.y}
                  width={PANEL2.width}
                  height={PANEL2.height}
                  fill="transparent"
                  style={{ cursor: "copy" }}
                  onClick={(e) => {
                    const p = toSvgPoint(e);
                    onCalibrationChange(withMassPoint(calibration, null, { x: pxToMass(p.x), y: pxToDistance(p.y) }));
                  }}
                >
                  <title>Click to add a point to the mass-correction reference line (d={calibration.mass.referenceD})</title>
                </rect>
              )}
              {selection.kind === "wind" && (
                <rect
                  x={PANEL3.x}
                  y={PANEL3.y}
                  width={PANEL3.width}
                  height={PANEL3.height}
                  fill="transparent"
                  style={{ cursor: "copy" }}
                  onClick={(e) => {
                    const p = toSvgPoint(e);
                    onCalibrationChange(withWindPoint(calibration, selection.direction, null, { x: pxToWind(p.x), y: pxToDistance(p.y) }));
                  }}
                >
                  <title>
                    Click to add a point to the wind-correction reference line ({selection.direction}, d={calibration.wind.referenceD})
                  </title>
                </rect>
              )}

              {selection.kind === "temp" &&
                selectedLineData?.points.map((point, i) => (
                  <circle
                    key={`pt-temp-${i}`}
                    cx={sxTemp(point.tempC)}
                    cy={sy(point.distanceM)}
                    r={8}
                    fill="#d72540"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: "move", touchAction: "none" }}
                    onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                    onPointerMove={(e) => {
                      if (e.buttons !== 1) return;
                      const p = toSvgPoint(e);
                      onCalibrationChange(withLinePoint(calibration, selection.pressureFt, i, { tempC: pxToTemp(p.x), distanceM: pxToDistance(p.y) }));
                    }}
                    onDoubleClick={() => onCalibrationChange(withRemovedLinePoint(calibration, selection.pressureFt, i))}
                  >
                    <title>
                      {point.tempC.toFixed(1)}°C, {point.distanceM.toFixed(0)} m — double-click to delete
                    </title>
                  </circle>
                ))}

              {selection.kind === "mass" &&
                calibration.mass.points.map((point, i) => {
                  const ignored = Math.abs(point.x - TAKEOFF.refMassKg) <= MASS_ANCHOR_TOLERANCE_KG;
                  return (
                    <circle
                      key={`pt-mass-${i}`}
                      cx={sxMass(point.x)}
                      cy={sy(point.y)}
                      r={8}
                      fill={ignored ? "#94a3b8" : "#d72540"}
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ cursor: "move", touchAction: "none" }}
                      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                      onPointerMove={(e) => {
                        if (e.buttons !== 1) return;
                        const p = toSvgPoint(e);
                        onCalibrationChange(withMassPoint(calibration, i, { x: pxToMass(p.x), y: pxToDistance(p.y) }));
                      }}
                      onDoubleClick={() => onCalibrationChange(withRemovedMassPoint(calibration, i))}
                    >
                      <title>
                        {point.x.toFixed(0)} kg, {point.y.toFixed(0)} m — double-click to delete
                        {ignored && ` (within ${MASS_ANCHOR_TOLERANCE_KG} kg of the ${TAKEOFF.refMassKg} kg reference line, so it's ignored — that point is always fixed at the panel's own d value)`}
                      </title>
                    </circle>
                  );
                })}

              {selection.kind === "wind" &&
                calibration.wind[selection.direction].map((point, i) => {
                  const ignored = Math.abs(point.x) <= WIND_ANCHOR_TOLERANCE_KT;
                  return (
                    <circle
                      key={`pt-wind-${i}`}
                      cx={sxWind(point.x)}
                      cy={sy(point.y)}
                      r={8}
                      fill={ignored ? "#94a3b8" : "#d72540"}
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ cursor: "move", touchAction: "none" }}
                      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                      onPointerMove={(e) => {
                        if (e.buttons !== 1 || selection.kind !== "wind") return;
                        const p = toSvgPoint(e);
                        onCalibrationChange(withWindPoint(calibration, selection.direction, i, { x: pxToWind(p.x), y: pxToDistance(p.y) }));
                      }}
                      onDoubleClick={() => selection.kind === "wind" && onCalibrationChange(withRemovedWindPoint(calibration, selection.direction, i))}
                    >
                      <title>
                        {point.x.toFixed(1)} kt, {point.y.toFixed(0)} m — double-click to delete
                        {ignored && ` (within ${WIND_ANCHOR_TOLERANCE_KT} kt of 0, so it's ignored — that point is always fixed at the panel's own d value)`}
                      </title>
                    </circle>
                  );
                })}
            </g>
          )}
        </svg>
      </div>

      {editable && (
        <div className="space-y-1.5 text-xs text-foreground-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Panel 1 (altitude/temp):</span>
            {PRESSURE_FAMILIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelection({ kind: "temp", pressureFt: p })}
                className={"rounded-sm px-2 py-1 " + (selection.kind === "temp" && selection.pressureFt === p ? "bg-accent text-background" : "instrument-frame")}
              >
                {p} ft {calibration.lines.find((l) => l.pressureFt === p)?.points.length ? "" : "(no data)"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Panel 2 (mass):</span>
            <button
              type="button"
              onClick={() => setSelection({ kind: "mass" })}
              className={"rounded-sm px-2 py-1 " + (selection.kind === "mass" ? "bg-accent text-background" : "instrument-frame")}
            >
              d={calibration.mass.referenceD} {calibration.mass.points.length ? "" : "(no data)"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide">Panel 3 (wind):</span>
            <button
              type="button"
              onClick={() => setSelection({ kind: "wind", direction: "head" })}
              className={"rounded-sm px-2 py-1 " + (selection.kind === "wind" && selection.direction === "head" ? "bg-accent text-background" : "instrument-frame")}
            >
              Headwind {calibration.wind.head.length ? "" : "(no data)"}
            </button>
            <button
              type="button"
              onClick={() => setSelection({ kind: "wind", direction: "tail" })}
              className={"rounded-sm px-2 py-1 " + (selection.kind === "wind" && selection.direction === "tail" ? "bg-accent text-background" : "instrument-frame")}
            >
              Tailwind {calibration.wind.tail.length ? "" : "(no data)"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-muted">
        {HOSTED_MODE && !editable && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showScan} onChange={(e) => setShowScan(e.target.checked)} />
            Original scan instead of vectors
          </label>
        )}
        {editable && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showScan} onChange={(e) => setShowScan(e.target.checked)} />
            Show scan underlay
          </label>
        )}
        {(!showScan || editable) && (
          <>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              Grid
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showFamilies} onChange={(e) => setShowFamilies(e.target.checked)} />
              Isolines
            </label>
          </>
        )}
        {showScan && scanMissing && <span className="text-warn">No local reference-charts/pa28-161-cadet-takeoff.png found.</span>}
      </div>
      {offChart && !editable && <p className="text-xs text-warn">Intermediate value exceeds the chart&apos;s 800 m scale — not drawn, see the numeric result above.</p>}
    </div>
  );
}
