import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar,
  ReferenceLine, AreaChart, BarChart, Bar, LineChart,
} from "recharts";
import {
  FaFutbol, FaCube, FaChartLine, FaUsers, FaSquareRootAlt, FaBalanceScale, FaHome, FaLock, FaUnlock,
} from "react-icons/fa";
import katex from "katex";
import "./site.css";
import data from "./data.json";
import Pitch3D from "./Pitch3D";
import Surface3D from "./Surface3D";
import { kickGapFor, pStrong, pct } from "./model";

const C = { ink2: "#4a4945", grid: "#e2e0da", blue: "#2a78d6", orange: "#eb6834", gold: "#d39b12" };
const TICK = { fontSize: 16, fill: "#4a4945" };

type Page = "story" | "shootout" | "surface" | "explorer" | "data" | "maths" | "honest";
const PAGES: { id: Page; label: string; icon: React.ReactNode; blurb: string }[] = [
  { id: "story", label: "Story", icon: <FaHome aria-hidden />, blurb: "" },
  { id: "shootout", label: "3D shootout", icon: <FaFutbol aria-hidden />, blurb: "Watch the kick-by-kick model play out in a 3D stadium." },
  { id: "surface", label: "3D probability", icon: <FaCube aria-hidden />, blurb: "Spin the exact win-probability surface for every pair of kickers." },
  { id: "explorer", label: "Team explorer", icon: <FaUsers aria-hidden />, blurb: "Pick any two national teams and compare a match with a shootout." },
  { id: "data", label: "The data", icon: <FaChartLine aria-hidden />, blurb: "612 real shootouts, 50 years of upsets, and the posterior." },
  { id: "maths", label: "The maths", icon: <FaSquareRootAlt aria-hidden />, blurb: "The model's story, its parameters and the recursion." },
  { id: "honest", label: "Honest bits", icon: <FaBalanceScale aria-hidden />, blurb: "The locked test set, my guesses, and what didn't work." },
];

// posterior predictive from the grid posterior of beta
const post = data.betaPost;
const postSum = post.reduce((s, x) => s + x.p, 0);
function shootoutChance(d: number) { return post.reduce((s, x) => s + x.p * pStrong(x.b, d), 0) / postSum; }
function shootoutBand(d: number): [number, number] {
  let c = 0; let lo = 0, hi = 0;
  for (const x of post) { c += x.p / postSum; if (!lo && c >= 0.05) lo = pStrong(x.b, d); if (!hi && c >= 0.95) hi = pStrong(x.b, d); }
  return [lo, hi];
}

function Stat({ big, label, color }: { big: string; label: string; color?: string }) {
  return <div className="stat"><b style={{ color }}>{big}</b><span>{label}</span></div>;
}

function Tex({ tex }: { tex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) katex.render(tex, ref.current, { output: "mathml", displayMode: true, throwOnError: false }); }, [tex]);
  return <div className="math" ref={ref} aria-label={tex} />;
}

// ---------------- pages ----------------
function Story({ go }: { go: (p: Page) => void }) {
  const [g, setG] = useState(65);
  const [locked, setLocked] = useState(false);
  const diff = g - 55;
  return (
    <>
      <section className="card guess">
        <h2>Before you scroll: make a guess</h2>
        <p className="lead">When the <b>better</b> team (by rating) goes to penalties, how often do you think it wins?</p>
        <div className="guessrow">
          <input type="range" min={30} max={95} value={g} disabled={locked} aria-label="Your guess, in percent" onChange={(e) => setG(parseInt(e.target.value))} />
          <span className="val">{g}%</span>
          {!locked && <button className="primary" onClick={() => setLocked(true)}><FaLock aria-hidden /> Lock it in</button>}
        </div>
        {locked && <p style={{ margin: "12px 0 0" }}><FaUnlock aria-hidden /> <b>Real answer: about 55%</b> (335 of 612 shootouts, 1976–2024).{" "}
          {Math.abs(diff) <= 3 ? "You nailed it!" : diff > 0 ? `You were ${diff} points too high. Most people expect skill to matter far more than it does.` : `You were ${-diff} points too low. Skill does count, just not much.`}</p>}
      </section>

      <section className={"card" + (locked ? "" : " blur")} aria-hidden={!locked}>
        <h2>The short answer: almost a coin flip, but not quite</h2>
        <div className="stats" style={{ marginTop: 12 }}>
          <Stat big="≈55%" label="how often the better team wins a shootout" color={C.blue} />
          <Stat big="≈¼" label="of a normal match's skill gap survives into a shootout" />
          <Stat big={pct(data.firstAll.mean)} label="win rate for the team kicking first (no real edge)" />
          <Stat big="tie" label="my model vs a fair coin on the locked 2025–26 test set" color={C.orange} />
        </div>
      </section>

      <section className="card">
        <h2>Why I asked: the 2026 World Cup</h2>
        <p className="lead">Four knockout games went to penalties. The favourite (by Elo rating) lost every one, and the team that kicked first lost every one too.</p>
        <div className="wc">
          {WC.map((r) => (
            <div className="wcc" key={r[0]}>
              <div className="m">{r[0]}</div>
              <div style={{ color: C.ink2 }}>Favourite: {r[1]}</div>
              <div className="bar" aria-hidden><div style={{ width: `${r[2]}%` }} /></div>
              <div>Model gave the favourite {r[2]}%</div>
              <div><b>{r[3]}</b> won <span className="x">✗ favourite</span></div>
            </div>
          ))}
        </div>
        <p className="note">My model gave "the favourite loses all four" about a 5% chance.</p>
      </section>

      <section className="card">
        <h2>Explore</h2>
        <div className="navcards">
          {PAGES.filter((p) => p.id !== "story").map((p) => (
            <button key={p.id} className="navcard" onClick={() => go(p.id)}>{p.icon}<b>{p.label}</b><span>{p.blurb}</span></button>
          ))}
        </div>
      </section>
    </>
  );
}

function ShootoutPage() {
  return (
    <section className="card">
      <h2>A shootout in 3D</h2>
      <p className="lead">Each kick goes in with its team's chance, independently of everything else. That's the whole model.
        Set the two teams' accuracy, press play, and watch. Then press it 20 times: the result swings around a lot, which is exactly why one shootout tells you so little.</p>
      <Pitch3D />
    </section>
  );
}

function SurfacePage() {
  return (
    <section className="card">
      <h2>Every possible shootout, as one 3D surface</h2>
      <p className="lead">For each pair of kick accuracies, I computed the <b>exact</b> chance Team A wins with a recursion over every scoreline.
        Height is that chance. Even 95% kickers against 50% kickers don't make it a sure thing.</p>
      <Surface3D />
    </section>
  );
}

function Explorer() {
  const teams = data.teams;
  const [a, setA] = useState("Argentina");
  const [b, setB] = useState("France");
  const ea = teams.find((t) => t.t === a)?.elo ?? 1500, eb = teams.find((t) => t.t === b)?.elo ?? 1500;
  const d = Math.abs(ea - eb);
  const fav = ea >= eb ? a : b, dog = ea >= eb ? b : a;
  const pm = pStrong(data.betaMatch, d), ps = shootoutChance(d), band = shootoutBand(d);
  const gap = useMemo(() => kickGapFor(ps), [ps]);
  const Duel = ({ title, p, note }: { title: string; p: number; note: string }) => (
    <div className="duelrow">
      <div className="lbl"><span>{title}</span><span>{note}</span></div>
      <div className="track" role="img" aria-label={`${fav} ${pct(p)}, ${dog} ${pct(1 - p)}`}>
        <div style={{ width: `${p * 100}%`, background: C.blue }}>{fav} {pct(p)}</div>
        <div style={{ width: `${(1 - p) * 100}%`, background: C.orange, justifyContent: "flex-end" }}>{pct(1 - p)} {dog}</div>
        <span className="mid" />
      </div>
    </div>
  );
  return (
    <section className="card">
      <h2>Pick any two teams</h2>
      <p className="lead">Ratings are my Elo ratings after every match up to October 2026 (top 120 active teams), on a neutral ground.</p>
      <div className="pick">
        <div><label htmlFor="ta" style={{ fontWeight: 700 }}>Team 1</label>
          <select id="ta" value={a} onChange={(e) => setA(e.target.value)}>{teams.map((t) => <option key={t.t} value={t.t}>{t.t} ({t.elo})</option>)}</select></div>
        <span className="vs">vs</span>
        <div><label htmlFor="tb" style={{ fontWeight: 700 }}>Team 2</label>
          <select id="tb" value={b} onChange={(e) => setB(e.target.value)}>{teams.map((t) => <option key={t.t} value={t.t}>{t.t} ({t.elo})</option>)}</select></div>
      </div>
      {a === b ? <p className="note">Pick two different teams.</p> : (
        <div className="duel">
          <p style={{ margin: 0 }}><b>{fav}</b> is {Math.round(d)} Elo points better.</p>
          <Duel title="If someone has to win in normal play" p={pm} note="(decisive matches)" />
          <Duel title="If it goes to penalties" p={ps} note={`(90% band ${pct(band[0])}–${pct(band[1])})`} />
          <div className="stats" style={{ marginTop: 16 }}>
            <Stat big={pct(pm - 0.5, 0).replace("%", " pts")} label="favourite's edge over a coin in a normal match" color={C.blue} />
            <Stat big={pct(ps - 0.5, 0).replace("%", " pts")} label="favourite's edge over a coin in a shootout" color={C.orange} />
            <Stat big={(gap * 100).toFixed(1) + " pts"} label="the same edge as a gap in kicking accuracy (around 75%)" />
          </div>
          <p className="note">Try Argentina v France: the 2022 World Cup final went to penalties, and the model gives the favourite only a small edge.</p>
        </div>
      )}
    </section>
  );
}

function DataPage() {
  const bins = data.bins.map((x) => ({ ...x, err: [x.rate - x.lo, x.hi - x.rate] }));
  return (
    <>
      <section className="card">
        <h2>How much skill survives? 612 real shootouts</h2>
        <p className="lead">Orange is how often the better team wins a normal match that someone wins. Blue is shootouts: my model with its 90% band, and the real data in five groups by rating gap.</p>
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <ComposedChart data={data.curve} margin={{ top: 10, right: 16, bottom: 30, left: 4 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="d" type="number" domain={[0, 420]} ticks={[0, 100, 200, 300, 400]} tick={TICK} label={{ value: "Rating gap (Elo points)", position: "bottom", offset: 10, fill: C.ink2, fontSize: 16 }} />
              <YAxis domain={[0.4, 1]} ticks={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]} tickFormatter={(v) => pct(v)} tick={TICK} width={58} />
              <Tooltip formatter={(v: any, n: any) => Array.isArray(v) ? [`${pct(v[0])}–${pct(v[1])}`, "90% band"] : [pct(Number(v), 1), n]} labelFormatter={(d) => `Gap: ${d} Elo`} />
              <ReferenceLine y={0.5} stroke={C.ink2} strokeDasharray="5 4" />
              <Area dataKey="band" stroke="none" fill={C.blue} fillOpacity={0.16} isAnimationActive={false} name="90% band" />
              <Line dataKey="match" stroke={C.orange} strokeWidth={3} dot={false} name="Normal match" isAnimationActive={false} />
              <Line dataKey="shoot" stroke={C.blue} strokeWidth={3} dot={false} name="Shootout (model)" isAnimationActive={false} />
              <Scatter data={bins} dataKey="rate" fill={C.blue} name="Real shootouts" isAnimationActive={false}><ErrorBar dataKey="err" width={0} stroke={C.blue} /></Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="legend"><span><i style={{ background: C.orange }} />Normal match</span><span><i style={{ background: C.blue }} />Shootout model and real data (dots)</span><span><i style={{ background: C.ink2 }} />Coin flip at 50%</span></div>
      </section>

      <section className="card grid2">
        <div>
          <h2>Shootouts per decade</h2>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={data.decades.filter((x) => x.n > 5)} margin={{ top: 10, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="dec" tick={TICK} /><YAxis tick={TICK} />
                <Tooltip formatter={(v: any) => [v, "shootouts"]} />
                <Bar dataKey="n" fill={C.blue} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h2>Favourite's win rate, by decade</h2>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={data.decades.filter((x) => x.n > 5)} margin={{ top: 10, right: 12, bottom: 4, left: -4 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="dec" tick={TICK} /><YAxis domain={[0.4, 0.7]} tickFormatter={(v) => pct(v)} tick={TICK} width={56} />
                <Tooltip formatter={(v: any) => [pct(Number(v), 1), "favourite won"]} />
                <ReferenceLine y={0.5} stroke={C.ink2} strokeDasharray="5 4" />
                <Line dataKey="fav" stroke={C.blue} strokeWidth={3} dot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="note">Always a little above a coin flip, and never by much.</p>
        </div>
      </section>

      <section className="card">
        <h2>How sure am I that skill counts at all?</h2>
        <p className="lead">The posterior for the parameter β. Almost all of it is above zero (P = {pct(data.betaShoot.P_gt_0, 1)}), but far below a normal match.</p>
        <div style={{ width: "100%", height: 230 }}>
          <ResponsiveContainer>
            <AreaChart data={data.betaPost} margin={{ top: 10, right: 16, bottom: 26, left: 4 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="b" type="number" domain={[-0.3, 1.4]} ticks={[0, 0.25, 0.5, 0.75, 1, 1.25]} tick={TICK} label={{ value: "β (0 = coin flip)", position: "bottom", offset: 8, fill: C.ink2, fontSize: 16 }} />
              <YAxis hide />
              <Tooltip formatter={(v: any) => [Number(v).toFixed(2), "density"]} labelFormatter={(b) => `β = ${b}`} />
              <ReferenceLine x={0} stroke={C.ink2} strokeDasharray="5 4" label={{ value: "coin flip", position: "insideTopRight", fill: C.ink2, fontSize: 16 }} />
              <ReferenceLine x={data.betaMatch} stroke={C.orange} strokeWidth={2} label={{ value: "normal match", position: "insideTopLeft", fill: C.ink2, fontSize: 16 }} />
              <Area dataKey="p" stroke={C.blue} strokeWidth={2} fill={C.blue} fillOpacity={0.2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>The biggest shootout upsets since 1976</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead><tr><th>Date</th><th>Underdog won</th><th>Favourite lost</th><th>Elo gap</th><th>Tournament</th></tr></thead>
            <tbody>{data.upsets.map((u) => <tr key={u.date + u.w}><td>{u.date}</td><td><b>{u.w}</b></td><td>{u.l}</td><td className="n">{u.d}</td><td>{u.tour}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Maths() {
  return (
    <>
      <section className="card">
        <h2>The model's story</h2>
        <p className="lead"><b>Step 1.</b> Each team has an Elo rating, built from all 49,940 internationals. A game that went to penalties counts as a draw, so shootouts never leak into the ratings. Let d be how many points better the stronger team is.</p>
        <p className="lead"><b>Step 2.</b> Each shootout is a Bernoulli trial. The better team wins with a probability given by logistic regression with one parameter, β:</p>
        <div className="mathcard"><Tex tex={"P(\\text{better team wins}\\mid d,\\beta)=\\sigma\\!\\left(\\beta\\cdot\\frac{\\ln 10}{400}\\,d\\right)=\\frac{1}{1+10^{-\\beta d/400}}"} /></div>
        <p className="lead">β = 0 is a pure coin flip. β = 1 is "as much skill as Elo expects". I put a flat prior on β and computed the posterior on a grid of 3,001 values:</p>
        <div className="mathcard"><Tex tex={"p(\\beta\\mid\\text{data})\\;\\propto\\;\\prod_{i=1}^{612} P(y_i\\mid d_i,\\beta)"} /></div>
        <p className="lead">Result: β ≈ {data.betaShoot.mean.toFixed(2)} (90% interval {data.betaShoot.q05.toFixed(2)}–{data.betaShoot.q95.toFixed(2)}) for shootouts, and ≈ {data.betaMatch.toFixed(2)} for normal matches.</p>
      </section>
      <section className="card">
        <h2>Kicking first: a Beta posterior</h2>
        <p className="lead">"Did the first kicker win?" is a Bernoulli trial with chance θ. With a flat prior, after k wins in n shootouts the posterior is a Beta distribution:</p>
        <div className="mathcard"><Tex tex={"\\theta\\mid k,n\\;\\sim\\;\\text{Beta}(k+1,\\;n-k+1)\\qquad k=139,\\;n=267"} /></div>
      </section>
      <section className="card">
        <h2>The exact shootout recursion</h2>
        <p className="lead">Let f(k, a, b) be the chance Team A wins after k kicks with score a–b. If the game is already decided it's 0 or 1. Otherwise the next kicker scores or misses:</p>
        <div className="mathcard"><Tex tex={"f(k,a,b)=p\\,f(k{+}1,a{+}1,b)+(1-p)\\,f(k{+}1,a,b)"} /></div>
        <p className="lead">Here p is that kicker's team accuracy. After ten kicks it's sudden death, which A wins with chance:</p>
        <div className="mathcard"><Tex tex={"\\frac{p_A(1-p_B)}{p_A(1-p_B)+p_B(1-p_A)}"} /></div>
        <p className="lead"><b>Why the order can't matter:</b> stopping early never changes who would have won after all five kicks, and sudden death treats both teams the same. So swapping who kicks first gives exactly the same number (try it on the 3D page).</p>
      </section>
      <section className="card">
        <h2>Scoring the model</h2>
        <p className="lead">The course's score is the log₁₀ likelihood of the results, and higher is better:</p>
        <div className="mathcard"><Tex tex={"\\text{score}=\\sum_i \\log_{10} P(y_i\\mid d_i)"} /></div>
      </section>
    </>
  );
}

function Honest() {
  const T = data.test;
  return (
    <>
      <section className="card">
        <h2>Opening the locked test set (once)</h2>
        <p className="lead">Before any analysis I locked away every shootout from 2025 onwards (37 games, including the 2026 World Cup). On those, the favourite won only {Math.round(T.strong_win_rate * T.n)} of {T.n}. Scores (log₁₀ likelihood, higher is better):</p>
        <div className="stats">
          <Stat big={T.score_model.toFixed(2)} label="my model" color={C.blue} />
          <Stat big={T.score_coin.toFixed(2)} label="a fair coin" />
          <Stat big={T.score_match.toFixed(2)} label={'"treat it like a normal match"'} color={C.orange} />
        </div>
        <p className="note">So on new data my model <b>tied a coin</b>, and easily beat "treat it like a match". Getting 16 or fewer out of 37 when you expect 55% happens about 10% of the time. The real issue is power: telling 55% from 50% needs about 590 shootouts, which is roughly 30 years of international football.</p>
      </section>
      <section className="card">
        <h2>My guesses vs reality</h2>
        <table className="t"><thead><tr><th>Guess (written before looking)</th><th>Reality</th></tr></thead><tbody>
          <tr><td>Better team wins ~55% (70% sure it's 50–60%)</td><td>54.7% in training ✓</td></tr>
          <tr><td>Kicking first wins ~54% (25% sure it's above 58%)</td><td>52.0%, and only 2.5% chance of above 58%</td></tr>
        </tbody></table>
      </section>
      <section className="card">
        <h2>What didn't work</h2>
        <ul className="lead" style={{ paddingLeft: 22 }}>
          <li>The real data is flat (50–55%) up to a gap of about 275 points, then jumps to 74%. One parameter may be the wrong shape.</li>
          <li>The model is overconfident for medium gaps and underconfident for big mismatches (average gap of 4.3 points across five groups).</li>
          <li>Elo rates whole teams, not penalty takers or goalkeepers. I couldn't find open kick-by-kick data.</li>
          <li>Only 269 of 700 shootouts record who kicked first.</li>
          <li>My 37-game test set was far too small to confirm a 5-point effect. I should have done the power maths first.</li>
        </ul>
      </section>
    </>
  );
}

const WC: [string, string, number, string][] = [
  ["Germany v Paraguay", "Germany", 54, "Paraguay"],
  ["Netherlands v Morocco", "Netherlands", 51, "Morocco"],
  ["Australia v Egypt", "Australia", 52, "Egypt"],
  ["Switzerland v Colombia", "Colombia", 53, "Switzerland"],
];

export default function App() {
  const [page, setPage] = useState<Page>("story");
  const top = useRef<HTMLDivElement>(null);
  const go = (p: Page) => { setPage(p); if (top.current) top.current.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div className="pai-root">
      <header className="hero">
        <div className="hero-in">
          <div>
            <div className="kicker">PROBABILITY FOR AI · REIHANEH RAHMATI</div>
            <h1>Is a penalty shootout just a <em>coin flip?</em></h1>
            <p>At the 2026 World Cup the favourite lost all four shootouts. So I rated every national team since 1872, checked 612 real shootouts, and built an exact kick-by-kick model to find out how much skill survives the penalty spot.</p>
          </div>
          <div className="coinstage" role="img" aria-label="A spinning coin: one side says 55% better team, the other 45% upset">
            <div className="coin"><div className="edge" />
              <div className="face"><span className="num">55%</span><span className="lab">BETTER<br />TEAM</span></div>
              <div className="face back"><span className="num">45%</span><span className="lab">UPSET</span></div>
            </div>
          </div>
        </div>
      </header>
      <nav className="nav" aria-label="Pages" ref={top}>
        <div className="nav-in">
          {PAGES.map((p) => (
            <button key={p.id} className={page === p.id ? "on" : ""} aria-current={page === p.id ? "page" : undefined} onClick={() => go(p.id)}>{p.icon}{p.label}</button>
          ))}
        </div>
      </nav>
      <main className="main">
        {page === "story" && <Story go={go} />}
        {page === "shootout" && <ShootoutPage />}
        {page === "surface" && <SurfacePage />}
        {page === "explorer" && <Explorer />}
        {page === "data" && <DataPage />}
        {page === "maths" && <Maths />}
        {page === "honest" && <Honest />}
      </main>
      <footer className="foot">
        Data: M. Jürisoo, International football results from 1872 (github.com/martj42/international_results, CC0), pulled 17 Nov 2026.
        Train: shootouts 1976–2024 · Locked test: 2025–Oct 2026.<br />Made by <b>Reihaneh Rahmati</b> for Probability for AI.
      </footer>
    </div>
  );
}
