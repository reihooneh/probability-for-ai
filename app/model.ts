// The probability model behind the site. Everything here is plain maths, no data.

/** Exact chance that team A wins a shootout when A kicks first.
 *  Each A kick scores with probability pa, each B kick with pb, all independent.
 *  Five kicks each (stopping early when one side can't catch up), then sudden death. */
export function pShootout(pa: number, pb: number): number {
  const memo = new Map<string, number>();
  const f = (k: number, ga: number, gb: number): number => {
    const key = k + "," + ga + "," + gb;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const ka = Math.floor((k + 1) / 2), kb = Math.floor(k / 2);
    let v: number;
    if (ga > gb + (5 - kb) || gb > ga + (5 - ka)) v = ga > gb ? 1 : 0;
    else if (k === 10) { const wa = pa * (1 - pb), wb = pb * (1 - pa); v = wa + wb === 0 ? 0.5 : wa / (wa + wb); }
    else if (k % 2 === 0) v = pa * f(k + 1, ga + 1, gb) + (1 - pa) * f(k + 1, ga, gb);
    else v = pb * f(k + 1, ga, gb + 1) + (1 - pb) * f(k + 1, ga, gb);
    memo.set(key, v);
    return v;
  };
  return f(0, 0, 0);
}

/** Chance A wins, given who kicks first. (It's the same either way, which is the point.) */
export function pWinA(pa: number, pb: number, aFirst: boolean): number {
  return aFirst ? pShootout(pa, pb) : 1 - pShootout(pb, pa);
}

export type Outcome = "goal" | "saved" | "wide" | "over";
export type Kick = { team: "A" | "B"; scored: boolean; outcome: Outcome; tx: number; ty: number; dive: number };

/** Plays one random shootout and returns every kick, with where the ball went (for the 3D scene). */
export function playShootout(pa: number, pb: number, aFirst: boolean, rnd: () => number = Math.random): { kicks: Kick[]; winner: "A" | "B" } {
  const kicks: Kick[] = [];
  let ga = 0, gb = 0, na = 0, nb = 0;
  const order: ("A" | "B")[] = aFirst ? ["A", "B"] : ["B", "A"];
  const side = () => (rnd() < 0.5 ? -1 : 1);
  const makeKick = (team: "A" | "B", scored: boolean): Kick => {
    if (scored) {
      const s = side();
      const tx = s * (1.0 + rnd() * 2.4), ty = 0.25 + rnd() * 1.85;
      const dive = rnd() < 0.7 ? -s : s * 0.75; // keeper usually goes the wrong way
      return { team, scored, outcome: "goal", tx, ty, dive };
    }
    const r = rnd();
    if (r < 0.7) { const s = side(); return { team, scored, outcome: "saved", tx: s * (0.8 + rnd() * 1.6), ty: 0.3 + rnd() * 1.1, dive: s }; }
    if (r < 0.88) { const s = side(); return { team, scored, outcome: "wide", tx: s * (3.9 + rnd() * 0.9), ty: 0.4 + rnd() * 1.4, dive: -s }; }
    return { team, scored, outcome: "over", tx: (rnd() - 0.5) * 5, ty: 2.7 + rnd() * 0.8, dive: side() * 0.5 };
  };
  for (let round = 0; round < 40; round++) {
    for (const t of order) {
      const s = rnd() < (t === "A" ? pa : pb);
      kicks.push(makeKick(t, s));
      if (t === "A") { na++; if (s) ga++; } else { nb++; if (s) gb++; }
      if (round < 5 && (ga > gb + (5 - nb) || gb > ga + (5 - na))) return { kicks, winner: ga > gb ? "A" : "B" };
    }
    if (round >= 4 && ga !== gb) return { kicks, winner: ga > gb ? "A" : "B" };
  }
  return { kicks, winner: ga >= gb ? "A" : "B" };
}

/** The data model: P(better team wins) when it is d Elo points better, keeping a share beta of the skill. */
export const pStrong = (beta: number, d: number) => 1 / (1 + Math.pow(10, (-beta * d) / 400));

/** Kick-accuracy gap (around 75%) that gives the same win chance as target. */
export function kickGapFor(target: number): number {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pShootout(0.75 + mid / 2, 0.75 - mid / 2) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const pct = (x: number, d = 0) => (x * 100).toFixed(d) + "%";
