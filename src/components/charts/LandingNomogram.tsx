"use client";

import { useRef, useState } from "react";
import { HOSTED_MODE, referenceChartUrl } from "@/lib/data-paths";
import { DEFAULT_LANDING_CALIBRATION, LANDING, landingChartY, landingCorrectedDistanceM, type WindDirection } from "@/lib/aircraft-performance/pa28-161-cadet";
import {
  scaleValueToPx,
  scalePxToValue,
  withLandingAxisPx,
  withLandingLinePoint,
  withAddedLandingLinePoint,
  withRemovedLandingLinePoint,
  withLandingCorrectionPoint,
  withAddedLandingCorrectionPoint,
  withRemovedLandingCorrectionPoint,
  type LandingCalibration,
  type LandingCorrectionKind,
  type LandingCorrectionVariant,
} from "@/lib/aircraft-performance/calibration";

// Geometry ported 1:1 from the reference reconstruction. See
// pa28-161-cadet.ts's file comment for provenance.
const G = { yTop: 220, yBottom: 799, curveYTop: 407 };

const LEFT_CLIP = { x: 46, y: 220, width: 381, height: 579 };
const RIGHT_CLIP = { x: 530, y: 407, width: 572, height: 392 };

function pathD(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}

// Head and tail aren't printed at the same wind speed on the real chart —
// see LANDING.maxHeadwindKt/maxTailwindKt in pa28-161-cadet.ts.
const WIND_VARIANTS: [WindDirection, number, LandingCorrectionVariant, string | undefined, number][] = [
  ["head", LANDING.maxHeadwindKt, "head", "7 4 2 4", 0.8],
  ["head", 0, "still", undefined, 1],
  ["tail", LANDING.maxTailwindKt, "tail", "10 6", 0.8],
];

const CORRECTION_LINES: { kind: LandingCorrectionKind; variant: LandingCorrectionVariant; label: string }[] = [
  { kind: "ground", variant: "still", label: "Ground · windstill" },
  { kind: "ground", variant: "head", label: `Ground · ${LANDING.maxHeadwindKt} kt head` },
  { kind: "ground", variant: "tail", label: `Ground · ${LANDING.maxTailwindKt} kt tail` },
  { kind: "obstacle", variant: "still", label: "Obstacle · windstill" },
  { kind: "obstacle", variant: "head", label: `Obstacle · ${LANDING.maxHeadwindKt} kt head` },
  { kind: "obstacle", variant: "tail", label: `Obstacle · ${LANDING.maxTailwindKt} kt tail` },
];

const PRESSURE_FAMILIES = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];

export function LandingNomogram({
  pressureFt,
  tempC,
  windKt,
  direction,
  calibration = DEFAULT_LANDING_CALIBRATION,
  editable = false,
  onCalibrationChange,
}: {
  pressureFt: number;
  tempC: number;
  windKt: number;
  direction: WindDirection;
  calibration?: LandingCalibration;
  editable?: boolean;
  onCalibrationChange?: (next: LandingCalibration) => void;
}) {
  const [showScan, setShowScan] = useState(editable);
  const [showGrid, setShowGrid] = useState(true);
  const [showFamilies, setShowFamilies] = useState(true);
  const [scanMissing, setScanMissing] = useState(false);
  const [selectedLine, setSelectedLine] = useState(0);
  const [selectedCorrection, setSelectedCorrection] = useState<{ kind: LandingCorrectionKind; variant: LandingCorrectionVariant }>({
    kind: "ground",
    variant: "still",
  });
  const svgRef = useRef<SVGSVGElement>(null);

  const asXTemp = scaleValueToPx(calibration.axes.temp);
  const pxToTemp = scalePxToValue(calibration.axes.temp);
  const asXDistance = scaleValueToPx(calibration.axes.distance);
  const pxToDistance = scalePxToValue(calibration.axes.distance);

  // The true (unclamped) y still drives the actual ground/obstacle math —
  // it's a perfectly valid formula evaluation even a few px past the
  // chart's printed edge (e.g. EDKA's own 623 ft elevation at a normal
  // temperature lands here). Only the drawing position clamps to the
  // visible box, same "clamp, don't hide the result" approach as the
  // pressure-altitude range above.
  const y = landingChartY(pressureFt, tempC, calibration);
  const yWasClamped = y < G.yTop || y > G.yBottom;
  const drawY = Math.min(Math.max(y, G.yTop), G.yBottom);
  const ground = landingCorrectedDistanceM("ground", y, windKt, direction, calibration);
  const obstacle = landingCorrectedDistanceM("obstacle", y, windKt, direction, calibration);
  const xt = asXTemp(tempC);
  const xg = asXDistance(ground);
  const xo = asXDistance(obstacle);

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

  const selectedLineData = calibration.lines.find((l) => l.pressureFt === selectedLine);
  const scanVisible = showScan && !scanMissing;
  const vectorVisible = editable || !scanVisible;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-sm border border-panel-border bg-white">
        <svg ref={svgRef} viewBox="0 0 1203 901" width="100%" style={{ minWidth: 640, display: "block" }} role="img" aria-label="Landing distance nomogram">
          <defs>
            <clipPath id="ld-left">
              <rect {...LEFT_CLIP} />
            </clipPath>
            <clipPath id="ld-right">
              <rect {...RIGHT_CLIP} />
            </clipPath>
          </defs>

          <rect x={14} y={16} width={1172} height={870} fill="#fff" stroke="#cbd5e1" />

          {scanVisible && (
            <image
              href={referenceChartUrl("pa28-161-cadet-landing")}
              x={0}
              y={0}
              width={1203}
              height={901}
              preserveAspectRatio="none"
              opacity={editable ? 0.75 : 0.95}
              onError={() => setScanMissing(true)}
            />
          )}

          {vectorVisible && (
            <g>
              {!scanVisible && (
                <g>
                  <text x={600} y={51} textAnchor="middle" fontSize={17} fontWeight={700} fill="#172b46">
                    LANDESTRECKE · KLAPPEN 40°
                  </text>
                  <text x={602} y={76} textAnchor="middle" fontSize={11} fill="#41536e">
                    1055 kg · Leerlauf · befestigte, ebene, trockene Bahn · 63 KIAS · maximale Bremsung
                  </text>
                  <text x={232} y={137} textAnchor="middle" fontSize={14} fontWeight={700} fill="#172b46">
                    1 DRUCKHÖHE + TEMPERATUR
                  </text>
                  <text x={826} y={137} textAnchor="middle" fontSize={14} fontWeight={700} fill="#172b46">
                    2 LANDE- &amp; WINDKORREKTUR
                  </text>
                  <text x={710} y={344} textAnchor="middle" fontSize={13} fontWeight={700} fill="#23364d">
                    Landelauf
                  </text>
                  <text x={967} y={344} textAnchor="middle" fontSize={13} fontWeight={700} fill="#23364d">
                    15 m Hindernisfreiheit (50 ft)
                  </text>
                  <text x={808} y={381} textAnchor="middle" fontSize={10.5} fill="#41536e">
                    Wind: ·—·— {LANDING.maxHeadwindKt} kn Gegenwind ━━━ Windstille – – – {LANDING.maxTailwindKt} kn Rückenwind
                  </text>
                  <text x={204} y={832} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    Außenlufttemperatur in °C
                  </text>
                  <text x={775} y={887} textAnchor="middle" fontSize={12} fontWeight={700} fill="#23364d">
                    Landestrecke (m, obere Skala: ft)
                  </text>
                </g>
              )}

              {showGrid && (
                <g stroke="#dfe6ef">
                  {Array.from({ length: 41 }, (_, i) => i * 2 - 40).map((t) => (
                    <line key={`gt-${t}`} x1={asXTemp(t)} x2={asXTemp(t)} y1={G.yTop} y2={G.yBottom} strokeWidth={t % 10 === 0 ? 0.8 : 0.5} />
                  ))}
                  {Array.from({ length: 40 }, (_, i) => 100 + i * 10).map((m) => (
                    <line key={`gm-${m}`} x1={asXDistance(m)} x2={asXDistance(m)} y1={G.curveYTop} y2={G.yBottom} strokeWidth={m % 50 === 0 ? 0.8 : 0.5} />
                  ))}
                  {Array.from({ length: Math.floor((G.yBottom - G.yTop) / 10) + 1 }, (_, i) => G.yTop + i * 10).map((yy) => (
                    <g key={`gy-${yy}`}>
                      <line x1={46} x2={427} y1={yy} y2={yy} strokeWidth={(yy - G.yTop) % 50 === 0 ? 0.8 : 0.5} />
                      {yy >= G.curveYTop && <line x1={530} x2={1102} y1={yy} y2={yy} strokeWidth={(yy - G.yTop) % 50 === 0 ? 0.8 : 0.5} />}
                    </g>
                  ))}
                </g>
              )}

              {showFamilies && (
                <g>
                  {PRESSURE_FAMILIES.map((p) => {
                    const pts: [number, number][] = [];
                    for (let t = -40; t <= 40.001; t += 0.5) pts.push([asXTemp(t), landingChartY(p, t, calibration)]);
                    const major = p % 2000 === 0;
                    const isSelected = editable && p === selectedLine;
                    const labelT = Math.max(-37, Math.min(35, 24 + (LANDING.refY + (LANDING.ordinatePer1000Ft * (2500 - p)) / 1000 - 660) / LANDING.ordinatePerC));
                    const ly = landingChartY(p, labelT, calibration);
                    return (
                      <g key={`pf-${p}`}>
                        <path
                          d={pathD(pts)}
                          stroke={isSelected ? "var(--accent)" : "#3d526e"}
                          fill="none"
                          strokeWidth={isSelected ? 3 : major ? 2.2 : 1.3}
                          opacity={isSelected ? 1 : major ? 1 : 0.5}
                          clipPath="url(#ld-left)"
                        />
                        {ly > G.yTop + 10 && ly < G.yBottom - 10 && (
                          <text x={asXTemp(labelT) + 3} y={ly - 7} fontSize={10} fill="#41536e" transform={`rotate(-45 ${asXTemp(labelT) + 3} ${ly - 7})`}>
                            {p} ft
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {!editable &&
                    (() => {
                      const pts: [number, number][] = [];
                      for (let p = 0; p <= 8000; p += 50) {
                        const t = 15 - (1.98 * p) / 1000;
                        pts.push([asXTemp(t), landingChartY(p, t, calibration)]);
                      }
                      return <path d={pathD(pts)} stroke="#253950" fill="none" strokeWidth={1.8} strokeDasharray="6 5" clipPath="url(#ld-left)" />;
                    })()}

                  {(["ground", "obstacle"] as const).map((kind) =>
                    WIND_VARIANTS.map(([dir, w, variant, dash, opacity], vi) => {
                      const pts: [number, number][] = [];
                      for (let yy = G.curveYTop; yy <= G.yBottom; yy += 2) {
                        pts.push([asXDistance(landingCorrectedDistanceM(kind, yy, w, dir, calibration)), yy]);
                      }
                      const isSelected = editable && selectedCorrection.kind === kind && selectedCorrection.variant === variant;
                      return (
                        <path
                          key={`${kind}-${vi}`}
                          d={pathD(pts)}
                          stroke={isSelected ? "var(--accent)" : "#3d526e"}
                          fill="none"
                          strokeWidth={isSelected ? 3.5 : w === 0 ? 3 : 2}
                          strokeDasharray={dash}
                          opacity={isSelected ? 1 : opacity}
                          clipPath="url(#ld-right)"
                        />
                      );
                    }),
                  )}
                </g>
              )}

              {!scanVisible && (
                <g>
                  {[
                    [46, 427, G.yTop],
                    [530, 1102, G.curveYTop],
                  ].map(([a, b, top], i) => (
                    <g key={i} stroke="#26384f" strokeWidth={1.4}>
                      <line x1={a} y1={top} x2={a} y2={G.yBottom} />
                      <line x1={a} y1={G.yBottom} x2={b} y2={G.yBottom} />
                      <line x1={b} y1={top} x2={b} y2={G.yBottom} />
                      <line x1={a} y1={top} x2={b} y2={top} />
                    </g>
                  ))}

                  {Array.from({ length: 9 }, (_, i) => -40 + i * 10).map((t) => (
                    <g key={`at-${t}`}>
                      <line x1={asXTemp(t)} x2={asXTemp(t)} y1={799} y2={808} stroke="#26384f" />
                      <text x={asXTemp(t)} y={821} textAnchor="middle" fontSize={11} fill="#445970">
                        {t}
                      </text>
                    </g>
                  ))}
                  {Array.from({ length: 16 }, (_, i) => 100 + i * 25).map((m) => (
                    <g key={`am-${m}`}>
                      <line x1={asXDistance(m)} x2={asXDistance(m)} y1={854} y2={854 + (m % 50 === 0 ? 13 : 7)} stroke="#26384f" />
                      {m % 50 === 0 && (
                        <text x={asXDistance(m)} y={881} textAnchor="middle" fontSize={11} fill="#445970">
                          {m}
                        </text>
                      )}
                    </g>
                  ))}
                  <line x1={asXDistance(100)} x2={asXDistance(490)} y1={854} y2={854} stroke="#26384f" strokeWidth={1.4} />
                  <text x={asXDistance(100) - 22} y={862} fontSize={12} fontWeight={700} fill="#23364d">
                    m
                  </text>
                  {Array.from({ length: 14 }, (_, i) => 300 + i * 100)
                    .map((feet) => ({ feet, x: asXDistance(feet * 0.3048) }))
                    .filter(({ x }) => x >= 530 && x <= 1102)
                    .map(({ feet, x }) => (
                      <g key={`af-${feet}`}>
                        <line x1={x} x2={x} y1={799} y2={805 + (feet % 200 === 0 ? 6 : 2)} stroke="#26384f" />
                        {feet % 200 === 0 && (
                          <text x={x} y={826} textAnchor="middle" fontSize={11} fill="#445970">
                            {feet}
                          </text>
                        )}
                      </g>
                    ))}
                  <text x={484} y={823} fontSize={12} fontWeight={700} fill="#23364d">
                    ft
                  </text>
                </g>
              )}
            </g>
          )}

          {/* trace — always on top, even over the scan. Drawn at drawY
              (clamped to the visible box) even when the true y overshoots
              it slightly — see the comment above `drawY`. */}
          {!editable && (
            <g>
              <g stroke="#d72540" strokeWidth={1.5} strokeDasharray="5 4" fill="none" opacity={0.75}>
                <path d={pathD([[xt, G.yBottom], [xt, drawY]])} />
                <path d={pathD([[46, drawY], [xt, drawY]])} opacity={0.5} />
                <path d={pathD([[xg, drawY], [xg, 854]])} />
                <path d={pathD([[xo, drawY], [xo, 854]])} />
              </g>
              <g stroke="#d72540" strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={pathD([[xt, drawY], [xo, drawY]])} />
                <path d={pathD([[xg, drawY - 8], [xg, drawY + 8]])} />
                <path d={pathD([[xo, drawY - 8], [xo, drawY + 8]])} />
              </g>
              {[[xt, drawY], [xg, drawY], [xo, drawY]].map(([x, yy], i) => (
                <circle key={i} cx={x} cy={yy} r={5} fill="#d72540" stroke="#fff" strokeWidth={2} />
              ))}
              <text x={xt + 10} y={drawY - 11} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                1
              </text>
              <text x={xg + 7} y={drawY - 11} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                2
              </text>
              <text x={Math.min(xo + 8, 1057)} y={drawY - 11} fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                3
              </text>
              <text x={xg} y={846} textAnchor="middle" fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                {Math.round(ground)} m
              </text>
              <text x={xo} y={846} textAnchor="middle" fontSize={12} fontWeight={800} fill="#b22239" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                {Math.round(obstacle)} m
              </text>
            </g>
          )}

          {/* calibration editor overlay */}
          {editable && onCalibrationChange && (
            <g>
              {(["pxA", "pxB"] as const).map((which) => {
                const px = which === "pxA" ? calibration.axes.temp.pxA : calibration.axes.temp.pxB;
                return (
                  <rect
                    key={`axis-temp-${which}`}
                    x={px - 6}
                    y={G.yBottom - 6}
                    width={12}
                    height={12}
                    fill="#0ea5e9"
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ cursor: "ew-resize", touchAction: "none" }}
                    onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                    onPointerMove={(e) => {
                      if (e.buttons !== 1) return;
                      const p = toSvgPoint(e);
                      onCalibrationChange(withLandingAxisPx(calibration, "temp", which, p.x));
                    }}
                  >
                    <title>temp axis, {which === "pxA" ? "start" : "end"} anchor</title>
                  </rect>
                );
              })}

              {(["pxA", "pxB"] as const).map((which) => {
                const px = which === "pxA" ? calibration.axes.distance.pxA : calibration.axes.distance.pxB;
                return (
                  <rect
                    key={`axis-distance-${which}`}
                    x={px - 6}
                    y={G.yBottom - 6}
                    width={12}
                    height={12}
                    fill="#22c55e"
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ cursor: "ew-resize", touchAction: "none" }}
                    onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                    onPointerMove={(e) => {
                      if (e.buttons !== 1) return;
                      const p = toSvgPoint(e);
                      onCalibrationChange(withLandingAxisPx(calibration, "distance", which, p.x));
                    }}
                  >
                    <title>distance axis, {which === "pxA" ? "start" : "end"} anchor</title>
                  </rect>
                );
              })}

              <rect
                x={LEFT_CLIP.x}
                y={LEFT_CLIP.y}
                width={LEFT_CLIP.width}
                height={LEFT_CLIP.height}
                fill="transparent"
                style={{ cursor: "copy" }}
                onClick={(e) => {
                  const p = toSvgPoint(e);
                  onCalibrationChange(withAddedLandingLinePoint(calibration, selectedLine, { tempC: pxToTemp(p.x), distanceM: p.y }));
                }}
              >
                <title>Click to add a point to the {selectedLine} ft line</title>
              </rect>

              {selectedLineData?.points.map((point, i) => (
                <circle
                  key={`pt-${i}`}
                  cx={asXTemp(point.tempC)}
                  cy={point.distanceM}
                  r={8}
                  fill="#d72540"
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ cursor: "move", touchAction: "none" }}
                  onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                  onPointerMove={(e) => {
                    if (e.buttons !== 1) return;
                    const p = toSvgPoint(e);
                    onCalibrationChange(withLandingLinePoint(calibration, selectedLine, i, { tempC: pxToTemp(p.x), distanceM: p.y }));
                  }}
                  onDoubleClick={() => onCalibrationChange(withRemovedLandingLinePoint(calibration, selectedLine, i))}
                >
                  <title>
                    {point.tempC.toFixed(1)}°C — double-click to delete
                  </title>
                </circle>
              ))}

              <rect
                x={RIGHT_CLIP.x}
                y={RIGHT_CLIP.y}
                width={RIGHT_CLIP.width}
                height={RIGHT_CLIP.height}
                fill="transparent"
                style={{ cursor: "copy" }}
                onClick={(e) => {
                  const p = toSvgPoint(e);
                  onCalibrationChange(
                    withAddedLandingCorrectionPoint(calibration, selectedCorrection.kind, selectedCorrection.variant, { x: p.y, y: pxToDistance(p.x) }),
                  );
                }}
              >
                <title>
                  Click to add a point to {selectedCorrection.kind}/{selectedCorrection.variant}
                </title>
              </rect>

              {calibration.corrections[selectedCorrection.kind][selectedCorrection.variant].map((point, i) => (
                <circle
                  key={`cp-${i}`}
                  cx={asXDistance(point.y)}
                  cy={point.x}
                  r={8}
                  fill="#0ea5e9"
                  stroke="#fff"
                  strokeWidth={2}
                  style={{ cursor: "move", touchAction: "none" }}
                  onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                  onPointerMove={(e) => {
                    if (e.buttons !== 1) return;
                    const p = toSvgPoint(e);
                    onCalibrationChange(
                      withLandingCorrectionPoint(calibration, selectedCorrection.kind, selectedCorrection.variant, i, { x: p.y, y: pxToDistance(p.x) }),
                    );
                  }}
                  onDoubleClick={() =>
                    onCalibrationChange(withRemovedLandingCorrectionPoint(calibration, selectedCorrection.kind, selectedCorrection.variant, i))
                  }
                >
                  <title>{Math.round(point.y)} m — double-click to delete</title>
                </circle>
              ))}
            </g>
          )}
        </svg>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
          <span className="font-semibold uppercase tracking-wide">Panel 1 (altitude/temp):</span>
          {PRESSURE_FAMILIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedLine(p)}
              className={"rounded-sm px-2 py-1 " + (p === selectedLine ? "bg-accent text-background" : "instrument-frame")}
            >
              {p} ft {calibration.lines.find((l) => l.pressureFt === p)?.points.length ? "" : "(no data)"}
            </button>
          ))}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
          <span className="font-semibold uppercase tracking-wide">Panel 2 (wind correction):</span>
          {CORRECTION_LINES.map(({ kind, variant, label }) => {
            const isSelected = selectedCorrection.kind === kind && selectedCorrection.variant === variant;
            const hasData = calibration.corrections[kind][variant].length > 0;
            return (
              <button
                key={`${kind}-${variant}`}
                type="button"
                onClick={() => setSelectedCorrection({ kind, variant })}
                className={"rounded-sm px-2 py-1 " + (isSelected ? "bg-accent text-background" : "instrument-frame")}
              >
                {label} {hasData ? "" : "(no data)"}
              </button>
            );
          })}
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
        {showScan && scanMissing && <span className="text-warn">No local reference-charts/pa28-161-cadet-landing.png found.</span>}
      </div>
      {yWasClamped && !editable && (
        <p className="text-xs text-warn">
          This pressure altitude/OAT combination falls just past the chart&apos;s visible edge — the numbers above are still computed
          from it, but the trace is pinned to the edge of the box rather than drawn off it.
        </p>
      )}
    </div>
  );
}
