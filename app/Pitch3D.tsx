import React, { useEffect, useRef, useState } from "react";
import { FaPlay, FaForward, FaRedo } from "react-icons/fa";
import { Kick, pWinA, playShootout, pct } from "./model";

// A hand-made 3D penalty scene: a pinhole camera behind the penalty spot looks at the goal.
// World units are metres. x = left/right, y = up, z = towards the goal (spot at z = 0, goal line at z = 11).
const CAM_Z = -3, CAM_Y = 1.0, GOAL_Z = 11, HALF_W = 3.66, BAR = 2.44, NET_Z = 13;

type Proj = (x: number, y: number, z: number) => [number, number, number];

function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, kick: Kick | null, u: number, flash: string, flashA: number) {
  const F = W * 0.95, hz = H * 0.40;
  const P: Proj = (x, y, z) => { const dz = z - CAM_Z; return [W / 2 + (F * x) / dz, hz - (F * (y - CAM_Y)) / dz, F / dz]; };
  // sky and stands
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#0b1d33"); sky.addColorStop(1, "#22466b");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
  // crowd: rows of coloured dots
  for (let row = 0; row < 7; row++) {
    const y = hz * 0.25 + row * (hz * 0.09);
    for (let i = 0; i < 90; i++) {
      const x = ((i * 97 + row * 53) % 1000) / 1000 * W;
      const hue = (i * 37 + row * 71) % 360;
      ctx.fillStyle = `hsla(${hue},55%,${45 + (row % 3) * 8}%,0.75)`;
      ctx.beginPath(); ctx.arc(x, y + Math.sin(i + row) * 2, Math.max(1.5, W / 420), 0, Math.PI * 2); ctx.fill();
    }
  }
  // floodlight glow
  const glow = ctx.createRadialGradient(W * 0.15, hz * 0.1, 0, W * 0.15, hz * 0.1, W * 0.3);
  glow.addColorStop(0, "rgba(255,255,230,0.35)"); glow.addColorStop(1, "rgba(255,255,230,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, hz);
  const glow2 = ctx.createRadialGradient(W * 0.85, hz * 0.1, 0, W * 0.85, hz * 0.1, W * 0.3);
  glow2.addColorStop(0, "rgba(255,255,230,0.35)"); glow2.addColorStop(1, "rgba(255,255,230,0)");
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, hz);
  // pitch with mown stripes
  for (let i = 0; i < 16; i++) {
    const z0 = -2.6 + i * 2.2, z1 = z0 + 2.2;
    const a = P(-60, 0, z0), b = P(60, 0, z0), c = P(60, 0, z1), d = P(-60, 0, z1);
    ctx.fillStyle = i % 2 ? "#2f8a4a" : "#287a41";
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "#24703b"; ctx.fillRect(0, hz, W, P(0, 0, 30)[1] - hz + 1);
  // lines
  const line = (pts: [number, number, number][], w = 0.12, col = "rgba(255,255,255,0.85)") => {
    ctx.strokeStyle = col; ctx.lineCap = "round";
    for (let i = 0; i < pts.length - 1; i++) {
      const a = P(...pts[i]), b = P(...pts[i + 1]);
      ctx.lineWidth = Math.max(1, w * (a[2] + b[2]) / 2);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  };
  line([[-40, 0, GOAL_Z], [40, 0, GOAL_Z]]);
  line([[-9.16, 0, GOAL_Z], [-9.16, 0, GOAL_Z - 5.5], [9.16, 0, GOAL_Z - 5.5], [9.16, 0, GOAL_Z]]);
  line([[-20.16, 0, GOAL_Z], [-20.16, 0, -2.6]]); line([[20.16, 0, GOAL_Z], [20.16, 0, -2.6]]);
  // penalty spot
  const sp = P(0, 0, 0); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(sp[0], sp[1], 0.09 * sp[2], 0.035 * sp[2], 0, 0, Math.PI * 2); ctx.fill();
  // net
  const net = "rgba(255,255,255,0.32)";
  for (let x = -HALF_W; x <= HALF_W + 1e-6; x += 0.41) line([[x, BAR, GOAL_Z], [x, 2.0, NET_Z], [x, 0, NET_Z]], 0.015, net);
  for (let y = 0; y <= 2.0; y += 0.4) line([[-HALF_W, y, NET_Z], [HALF_W, y, NET_Z]], 0.015, net);
  for (const sx of [-HALF_W, HALF_W]) {
    for (let z = GOAL_Z; z <= NET_Z + 1e-6; z += 0.5) line([[sx, 0, z], [sx, BAR - (z - GOAL_Z) * 0.22, z]], 0.015, net);
    line([[sx, BAR, GOAL_Z], [sx, 2.0, NET_Z], [sx, 0, NET_Z]], 0.03, net);
  }
  for (let t = 0; t <= 1.0001; t += 0.25) line([[-HALF_W, BAR - t * 0.44, GOAL_Z + t * 2], [HALF_W, BAR - t * 0.44, GOAL_Z + t * 2]], 0.015, net);

  // ball position for this moment
  let bx = 0, by = 0.11, bz = 0;
  if (kick) {
    const stop = kick.outcome === "saved" ? 0.93 : kick.outcome === "goal" ? 1.12 : 1.25;
    const uu = Math.min(u, 1);
    const tz = GOAL_Z * stop;
    bx = kick.tx * uu; bz = tz * uu; by = 0.11 + (kick.ty - 0.11) * uu + 0.35 * Math.sin(Math.PI * uu);
    if (kick.outcome === "goal" && u >= 1) { bz = Math.min(NET_Z - 0.2, tz); by = Math.max(0.11, kick.ty - (u - 1) * 3); }
    if (kick.outcome === "saved" && u >= 1) { const r = Math.min(1, (u - 1) * 2); bx = kick.tx * (1 - 0.3 * r); bz = tz - 3 * r; by = Math.max(0.11, kick.ty * (1 - r) + 0.6 * Math.sin(Math.PI * r)); }
  }
  const keeperDraw = () => {
    const dive = kick ? kick.dive : 0;
    const t = kick ? Math.min(1, Math.max(0, (u - 0.15) / 0.75)) : 0;
    const kx = dive * 2.5 * t, ky = 0.0 + Math.sin(Math.PI * t) * 0.35 * Math.abs(dive);
    const base = P(kx, ky, GOAL_Z - 0.3);
    const s = base[2];
    ctx.save(); ctx.translate(base[0], base[1]); ctx.rotate(-dive * t * 1.25);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, 0.02 * s, 0.45 * s, 0.08 * s, 0, 0, Math.PI * 2); ctx.fill();
    // legs, body, arms, head (keeper in yellow)
    ctx.fillStyle = "#1d1d1d"; ctx.fillRect(-0.22 * s, -0.9 * s, 0.17 * s, 0.9 * s); ctx.fillRect(0.05 * s, -0.9 * s, 0.17 * s, 0.9 * s);
    const kit = ctx.createLinearGradient(-0.3 * s, 0, 0.3 * s, 0); kit.addColorStop(0, "#d9b400"); kit.addColorStop(0.5, "#ffe14d"); kit.addColorStop(1, "#c9a400");
    ctx.fillStyle = kit; ctx.beginPath(); ctx.roundRect(-0.3 * s, -1.55 * s, 0.6 * s, 0.72 * s, 0.12 * s); ctx.fill();
    ctx.strokeStyle = "#ffe14d"; ctx.lineWidth = 0.13 * s; ctx.lineCap = "round";
    const reach = 0.55 + 0.35 * t;
    ctx.beginPath(); ctx.moveTo(-0.27 * s, -1.45 * s); ctx.lineTo(-reach * s, -1.95 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.27 * s, -1.45 * s); ctx.lineTo(reach * s, -1.95 * s); ctx.stroke();
    ctx.fillStyle = "#f2f2f2"; ctx.beginPath(); ctx.arc(-reach * s, -1.98 * s, 0.09 * s, 0, Math.PI * 2); ctx.arc(reach * s, -1.98 * s, 0.09 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c58c5c"; ctx.beginPath(); ctx.arc(0, -1.72 * s, 0.14 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const ballDraw = () => {
    const sh = P(bx, 0, bz), b = P(bx, by, bz), r = 0.11 * b[2];
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], r * 1.1, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(b[0] - r * 0.35, b[1] - r * 0.4, r * 0.1, b[0], b[1], r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#e6e6e6"); g.addColorStop(1, "#9a9a9a");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b[0], b[1], r, 0, Math.PI * 2); ctx.fill();
    // classic football: a black pentagon in the middle and five half-pentagons around the edge
    const spin = kick ? u * 9 : 0.3;
    const pent = (x: number, y: number, rr: number, rot: number) => {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const ang = rot + (k * 2 * Math.PI) / 5 - Math.PI / 2; const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
    };
    ctx.save(); ctx.beginPath(); ctx.arc(b[0], b[1], r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#1f1f1f"; pent(b[0], b[1], r * 0.3, spin);
    for (let k = 0; k < 5; k++) { const ang = spin + (k * 2 * Math.PI) / 5 + Math.PI / 5 - Math.PI / 2; pent(b[0] + Math.cos(ang) * r * 0.92, b[1] + Math.sin(ang) * r * 0.92, r * 0.28, ang); }
    ctx.strokeStyle = "rgba(60,60,60,0.5)"; ctx.lineWidth = Math.max(0.6, r * 0.04);
    for (let k = 0; k < 5; k++) { const ang = spin + (k * 2 * Math.PI) / 5 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(b[0] + Math.cos(ang) * r * 0.3, b[1] + Math.sin(ang) * r * 0.3); ctx.lineTo(b[0] + Math.cos(ang) * r * 0.75, b[1] + Math.sin(ang) * r * 0.75); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b[0], b[1], r, 0, Math.PI * 2); ctx.stroke();
  };
  // draw back-to-front: things behind the goal line after the net, keeper, then ball (in front unless in the net)
  const ballBehindKeeper = bz > GOAL_Z - 0.3;
  if (ballBehindKeeper) { ballDraw(); }
  // posts and crossbar in front of the net
  const post = "#ffffff";
  line([[-HALF_W, 0, GOAL_Z], [-HALF_W, BAR, GOAL_Z], [HALF_W, BAR, GOAL_Z], [HALF_W, 0, GOAL_Z]], 0.12, post);
  keeperDraw();
  if (!ballBehindKeeper) ballDraw();
  // result flash
  if (flash && flashA > 0) {
    ctx.save(); ctx.globalAlpha = flashA;
    ctx.font = `900 ${Math.round(W * 0.075)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.lineWidth = W * 0.008; ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText(flash, W / 2, H * 0.62); ctx.fillStyle = flash === "GOAL!" ? "#ffd166" : "#ffffff"; ctx.fillText(flash, W / 2, H * 0.62);
    ctx.restore();
  }
}

const LABEL: Record<string, string> = { goal: "GOAL!", saved: "SAVED!", wide: "WIDE!", over: "OVER!" };

export default function Pitch3D() {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [pa, setPa] = useState(0.8);
  const [pb, setPb] = useState(0.7);
  const [aFirst, setAFirst] = useState(true);
  const [game, setGame] = useState<{ kicks: Kick[]; winner: "A" | "B" } | null>(null);
  const [shown, setShown] = useState(0); // kicks fully shown
  const [record, setRecord] = useState({ a: 0, n: 0 });
  const anim = useRef({ i: -1, start: 0 });
  const raf = useRef(0);
  const [W, setW] = useState(900);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const H = Math.round(W * 0.62);
  const paint = (kick: Kick | null, u: number, flash = "", fa = 0) => {
    const c = cv.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, W, H, kick, u, flash, fa);
  };
  useEffect(() => { if (anim.current.i < 0) paint(null, 0); }, [W]);

  const run = (g: { kicks: Kick[]; winner: "A" | "B" }) => {
    cancelAnimationFrame(raf.current);
    anim.current = { i: 0, start: performance.now() };
    setShown(0);
    const KICK_MS = 1500;
    const step = (now: number) => {
      const a = anim.current;
      const el = now - a.start;
      const k = g.kicks[a.i];
      const u = Math.min(el / 520, 2.2);
      const fa = el > 520 ? Math.min(1, (el - 520) / 150) * (1 - Math.max(0, (el - 1250) / 250)) : 0;
      paint(k, u, LABEL[k.outcome], fa);
      if (el > KICK_MS) {
        a.i += 1; a.start = now; setShown(a.i);
        if (a.i >= g.kicks.length) { anim.current.i = -1; paint(null, 0); return; }
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const play = () => {
    const g = playShootout(pa, pb, aFirst);
    setGame(g); setRecord((r) => ({ a: r.a + (g.winner === "A" ? 1 : 0), n: r.n + 1 }));
    run(g);
  };
  const skip = () => { cancelAnimationFrame(raf.current); anim.current.i = -1; if (game) setShown(game.kicks.length); paint(null, 0); };

  const kicksShown = game ? game.kicks.slice(0, shown) : [];
  const goals = (t: "A" | "B") => kicksShown.filter((k) => k.team === t && k.scored).length;
  const done = game && shown >= game.kicks.length;
  const exact = pWinA(pa, pb, aFirst);

  return (
    <div>
      <div className="scorebar" aria-live="polite">
        {(["A", "B"] as const).map((t) => (
          <div key={t} className="scorerow">
            <span className={"teamtag " + (t === "A" ? "ta" : "tb")}>Team {t}</span>
            <span className="dots">
              {Array.from({ length: Math.max(5, game ? Math.ceil(game.kicks.length / 2) : 5) }, (_, i) => {
                const k = kicksShown.filter((x) => x.team === t)[i];
                return <span key={i} className={"dot " + (k ? (k.scored ? "g" : "m") : "")} aria-label={k ? (k.scored ? "scored" : "missed") : "not taken"}>{k ? (k.scored ? "✓" : "✗") : ""}</span>;
              })}
            </span>
            <span className="big">{goals(t)}</span>
          </div>
        ))}
      </div>
      <div ref={wrap} className="canvaswrap">
        <canvas ref={cv} style={{ width: W, height: H }} role="img"
          aria-label="3D view from behind the penalty spot: the goal, the net, the goalkeeper and the ball. Each kick flies towards the goal and is scored, saved or missed." />
        {done && game && <div className="winner">Team {game.winner} wins {goals("A")}–{goals("B")}</div>}
      </div>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="pa">Team A scores <b>{pct(pa)}</b> of kicks</label>
          <input id="pa" type="range" min={0.5} max={0.95} step={0.01} value={pa} onChange={(e) => setPa(parseFloat(e.target.value))} />
          <label htmlFor="pb">Team B scores <b>{pct(pb)}</b> of kicks</label>
          <input id="pb" type="range" min={0.5} max={0.95} step={0.01} value={pb} onChange={(e) => setPb(parseFloat(e.target.value))} />
          <div className="seg" role="group" aria-label="Who kicks first">
            <button className={aFirst ? "on" : ""} onClick={() => setAFirst(true)}>A kicks first</button>
            <button className={!aFirst ? "on" : ""} onClick={() => setAFirst(false)}>B kicks first</button>
          </div>
        </div>
        <div className="ctl">
          <div className="exact"><span>Exact chance Team A wins</span><b>{pct(exact, 2)}</b></div>
          <div className="btnrow">
            <button className="primary" onClick={play}><FaPlay aria-hidden /> Take a shootout</button>
            <button onClick={skip} disabled={!game || !!done}><FaForward aria-hidden /> Skip to result</button>
          </div>
          {record.n > 0 && (
            <p className="note">
              You've watched {record.n} shootout{record.n > 1 ? "s" : ""}: A won {record.a} ({pct(record.a / record.n)}). The exact answer is {pct(exact, 1)}, and your count drifts towards it the more you play.{" "}
              <button className="linkbtn" onClick={() => setRecord({ a: 0, n: 0 })}><FaRedo aria-hidden /> reset</button>
            </p>
          )}
          <p className="note">Flip who kicks first and watch the exact number: it doesn't move at all. In this model the order can't matter.</p>
        </div>
      </div>
    </div>
  );
}
