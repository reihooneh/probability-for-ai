import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaUndo, FaRedo } from "react-icons/fa";
import { pShootout, pct } from "./model";

// A rotatable 3D surface of the exact win probability, drawn on a canvas with the painter's algorithm.
const N = 24, LO = 0.5, HI = 0.95;
const val = (i: number) => LO + ((HI - LO) * i) / (N - 1);

function colour(p: number): string {
  // red (A likely loses) -> warm grey (coin flip) -> blue (A likely wins)
  const t = Math.max(-1, Math.min(1, (p - 0.5) * 2.2));
  const mid = [236, 233, 225], red = [227, 73, 72], blue = [42, 120, 214];
  const c = t < 0 ? red : blue, a = Math.abs(t);
  return `rgb(${Math.round(mid[0] + (c[0] - mid[0]) * a)},${Math.round(mid[1] + (c[1] - mid[1]) * a)},${Math.round(mid[2] + (c[2] - mid[2]) * a)})`;
}

export default function Surface3D() {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [W, setW] = useState(800);
  const [yaw, setYaw] = useState(-0.75);
  const [tilt, setTilt] = useState(0.95);
  const [pa, setPa] = useState(0.8);
  const [pb, setPb] = useState(0.7);
  const drag = useRef<{ x: number; y: number; yaw: number; tilt: number } | null>(null);
  const [auto, setAuto] = useState(true);

  const Z = useMemo(() => {
    const z: number[][] = [];
    for (let i = 0; i < N; i++) { z.push([]); for (let j = 0; j < N; j++) z[i].push(pShootout(val(i), val(j))); }
    return z;
  }, []);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!auto || reduce) return;
    let id = 0, last = performance.now();
    const tick = (now: number) => { setYaw((y) => y + (now - last) * 0.00012); last = now; id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [auto]);

  const H = Math.round(Math.min(W * 0.72, 560));
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const S = Math.min(W, H * 1.25) * 0.46, cx = W / 2, cy = H * 0.5;
    const cy_ = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    // world: x = pA axis, y = pB axis, z = probability (height)
    const proj = (x: number, y: number, z: number): [number, number, number] => {
      const X = x * cy_ - y * sy, Y = x * sy + y * cy_;
      const depth = Y * ct + z * st; // bigger = further
      return [cx + X * S, cy + (Y * st - z * ct) * S * 0.9, depth];
    };
    const wx = (p: number) => (p - (LO + HI) / 2) / (HI - LO);
    const wz = (p: number) => (p - 0.5) * 0.9;
    // floor grid and box
    ctx.strokeStyle = "rgba(82,81,78,0.35)"; ctx.lineWidth = 1;
    for (let k = 0; k <= 9; k++) {
      const v = LO + (k * (HI - LO)) / 9;
      let a = proj(wx(v), wx(LO), wz(0)), b = proj(wx(v), wx(HI), wz(0));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      a = proj(wx(LO), wx(v), wz(0)); b = proj(wx(HI), wx(v), wz(0));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // the coin-flip plane at 50%, faint
    const c50 = [proj(wx(LO), wx(LO), 0), proj(wx(HI), wx(LO), 0), proj(wx(HI), wx(HI), 0), proj(wx(LO), wx(HI), 0)];
    ctx.fillStyle = "rgba(237,161,0,0.10)"; ctx.beginPath(); c50.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    // quads, far to near
    const quads: { d: number; pts: [number, number, number][]; p: number }[] = [];
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
      const pts = [proj(wx(val(i)), wx(val(j)), wz(Z[i][j])), proj(wx(val(i + 1)), wx(val(j)), wz(Z[i + 1][j])),
        proj(wx(val(i + 1)), wx(val(j + 1)), wz(Z[i + 1][j + 1])), proj(wx(val(i)), wx(val(j + 1)), wz(Z[i][j + 1]))];
      quads.push({ d: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4, pts, p: (Z[i][j] + Z[i + 1][j] + Z[i + 1][j + 1] + Z[i][j + 1]) / 4 });
    }
    quads.sort((a, b) => b.d - a.d);
    for (const q of quads) {
      ctx.fillStyle = colour(q.p); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 0.6;
      ctx.beginPath(); q.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // marker for the chosen pair
    const pz = pShootout(pa, pb);
    const top = proj(wx(pa), wx(pb), wz(pz)), bot = proj(wx(pa), wx(pb), wz(0) - 0.45);
    ctx.strokeStyle = "#0b0b0b"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bot[0], bot[1]); ctx.lineTo(top[0], top[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#ffd166"; ctx.strokeStyle = "#0b0b0b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(top[0], top[1], 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = "800 18px Inter, system-ui, sans-serif"; ctx.fillStyle = "#0b0b0b"; ctx.textAlign = "left";
    ctx.fillText(pct(pz, 1), top[0] + 14, top[1] - 8);
    // axis labels
    ctx.font = "600 16px Inter, system-ui, sans-serif"; ctx.fillStyle = "#52514e"; ctx.textAlign = "center";
    const ax = proj(wx(0.725), wx(LO) - 0.18, wz(0)), ay = proj(wx(LO) - 0.18, wx(0.725), wz(0));
    ctx.fillText("Team A accuracy →", ax[0], ax[1]); ctx.fillText("Team B accuracy →", ay[0], ay[1]);
    const a95 = proj(wx(0.95), wx(LO) - 0.08, wz(0)); ctx.fillText("95%", a95[0], a95[1]);
    const b95 = proj(wx(LO) - 0.08, wx(0.95), wz(0)); ctx.fillText("95%", b95[0], b95[1]);
    const o = proj(wx(LO) - 0.08, wx(LO) - 0.08, wz(0)); ctx.fillText("50%", o[0], o[1]);
  }, [W, H, yaw, tilt, pa, pb, Z]);

  const down = (e: React.PointerEvent) => { setAuto(false); drag.current = { x: e.clientX, y: e.clientY, yaw, tilt }; (e.target as Element).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    setYaw(d.yaw + (e.clientX - d.x) * 0.01);
    setTilt(Math.max(0.25, Math.min(1.45, d.tilt + (e.clientY - d.y) * 0.006)));
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { setAuto(false); setYaw((y) => y - 0.15); e.preventDefault(); }
    if (e.key === "ArrowRight") { setAuto(false); setYaw((y) => y + 0.15); e.preventDefault(); }
    if (e.key === "ArrowUp") { setTilt((t) => Math.max(0.25, t - 0.1)); e.preventDefault(); }
    if (e.key === "ArrowDown") { setTilt((t) => Math.min(1.45, t + 0.1)); e.preventDefault(); }
  };

  return (
    <div>
      <div ref={wrap} className="canvaswrap light">
        <canvas ref={cv} style={{ width: W, height: H, touchAction: "none", cursor: "grab" }} tabIndex={0}
          role="img" aria-label={`3D surface of the exact chance Team A wins, for every pair of kick accuracies from 50% to 95%. The marked point, A at ${pct(pa)} and B at ${pct(pb)}, gives ${pct(pShootout(pa, pb), 1)}. Use the arrow keys to rotate.`}
          onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onKeyDown={key} />
      </div>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="spa">Team A scores <b>{pct(pa)}</b></label>
          <input id="spa" type="range" min={0.5} max={0.95} step={0.01} value={pa} onChange={(e) => setPa(parseFloat(e.target.value))} />
          <label htmlFor="spb">Team B scores <b>{pct(pb)}</b></label>
          <input id="spb" type="range" min={0.5} max={0.95} step={0.01} value={pb} onChange={(e) => setPb(parseFloat(e.target.value))} />
        </div>
        <div className="ctl">
          <div className="btnrow">
            <button onClick={() => { setAuto(false); setYaw((y) => y - 0.3); }}><FaUndo aria-hidden /> Rotate left</button>
            <button onClick={() => { setAuto(false); setYaw((y) => y + 0.3); }}><FaRedo aria-hidden /> Rotate right</button>
          </div>
          <p className="note">Drag the surface, or click it and use the arrow keys. Blue means A is favoured, red means B is, and the pale band is "basically a coin flip". The surface is a gentle slope, not a cliff: being a better kicking team helps, but slowly.</p>
        </div>
      </div>
    </div>
  );
}
