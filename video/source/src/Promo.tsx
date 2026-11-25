import React from "react";
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import script from "../voice/promo/script.json";
import vo from "../public/promo/vo/manifest.json";

// 横屏宣传片（1920×1080）：全马来语旁白（ElevenLabs 马来西亚女声）+ 中文字幕。
// 画面是小程序白天「旅行手账」版的真实截图（开发者工具模拟器 390×844），配色字体跟小程序一致。
// 时间线按配音长度自动排：改 voice/promo/script.json 后重新配音即可。
export const PROMO_FPS = 30;
type Line = { key: string; ms: string; zh: string };
const LINES = script.lines as Line[];
const VO = vo as Record<string, { file: string; sec: number }>;
const LEAD = 0.6, GAP = 0.45, TAIL = 3.2;

const C = { paper: "#f4eee1", paper2: "#e9dfc8", card: "#fffdf8", ink: "#1c2420", ink2: "#47524c", mute: "#7d847e", line: "#dcd1bb", green: "#1f5a43", greenD: "#15402f", teal: "#123f45", amber: "#c46d1c", amberL: "#f5e2c7", red: "#b4472f" };
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const LATIN = 'Georgia, "Times New Roman", serif';
const MONO = 'Menlo, "SF Mono", monospace';
const SANS = '"PingFang SC", "Hiragino Sans GB", -apple-system, sans-serif';
const ease = Easing.bezier(0.22, 1, 0.36, 1);

type Scene = { key: string; kind: "hook" | "phone" | "end"; shot?: string; no?: string; kicker?: string; h: string[]; zh: string; bird?: string; focus?: [number, number] };
const SCENES: Scene[] = [
  { key: "s1", kind: "hook", h: ["Nak belajar", "bahasa Melayu?"], zh: "想学马来语？", bird: "c-welcome-cut" },
  { key: "s2", kind: "phone", shot: "home", no: "01", kicker: "TIKET HARI INI", h: ["Ulang kaji dahulu,", "kemudian yang baharu."], zh: "今日车票 · 先温故，再知新", focus: [0.5, 0.36] },
  { key: "s3", kind: "phone", shot: "atlas", no: "02", kicker: "SEMUA BOLEH DIDENGAR", h: ["Hampir 3,000", "perkataan lazim."], zh: "图鉴 · 近三千高频词，个个能听", focus: [0.5, 0.62] },
  { key: "s4", kind: "phone", shot: "quiz", no: "03", kicker: "KUIZ PENDEK", h: ["Ingat", "lebih lama."], zh: "小测 · 记得更久", focus: [0.5, 0.4] },
  { key: "s5", kind: "phone", shot: "battle", no: "04", kicker: "GELANGGANG MINGGUAN", h: ["Cabar", "rakan-rakan anda."], zh: "周擂台 · 和同学比一比", focus: [0.5, 0.3] },
  { key: "s6", kind: "phone", shot: "me", no: "05", kicker: "PASPORT", h: ["Sepuluh stesen,", "satu cap setiap stesen."], zh: "护照 · 十站路线，学完一站盖一个章", focus: [0.5, 0.45] },
  { key: "s7", kind: "end", h: ["Jom belajar", "bahasa Melayu!"], zh: "一起学马来语", bird: "c-cheer-cut" },
];

export const promoTimeline = () => {
  const at: Record<string, [number, number]> = {};
  let t = LEAD;
  for (const l of LINES) { at[l.key] = [t, t + VO[l.key].sec]; t += VO[l.key].sec + GAP; }
  const total = t - GAP + TAIL;
  const scenes = SCENES.map((s, i) => ({ ...s, start: i === 0 ? 0 : at[s.key][0] - 0.25, end: SCENES[i + 1] ? at[SCENES[i + 1].key][0] - 0.25 : total }));
  return { at, scenes, total };
};
export const promoFrames = () => Math.ceil(promoTimeline().total * PROMO_FPS);

const Rise: React.FC<{ at?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at = 0, y = 40, children, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

// 纸面背景：纸色 + 细格线 + 角上的大号站名水印
const Paper: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`, backgroundSize: "60px 60px", backgroundPosition: `${-f * 0.15}px ${-f * 0.1}px`, opacity: 0.5 }} />
      <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 30% 40%, transparent 40%, ${C.paper2}88 100%)` }} />
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{ idx: number }> = ({ idx }) => (
  <div style={{ position: "absolute", left: 96, right: 96, top: 56, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: MONO, fontSize: 22, letterSpacing: "0.14em", color: C.mute }}>
    <span>JOMBELAJAR · KOSA KATA BAHASA MELAYU</span>
    <span style={{ display: "flex", gap: 8 }}>{SCENES.slice(1, 6).map((_, i) => <i key={i} style={{ width: 44, height: 6, borderRadius: 3, background: i < idx ? C.green : i === idx ? C.amber : C.paper2 }} />)}</span>
  </div>
);

const Phone: React.FC<{ shot: string; focus: [number, number]; dur: number }> = ({ shot, focus, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: f, fps, config: { damping: 16, stiffness: 110, mass: 0.9 } });
  const out = interpolate(f, [dur - 8, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(f, [10, dur], [1, 1.07], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const W = 382, H = 826;
  return (
    <div style={{ position: "absolute", right: 230, top: 70, width: W, height: H, transform: `translateY(${(1 - inP) * 180 - out * 60}px) rotate(${(1 - inP) * 5 - 1.5}deg)`, opacity: Math.min(1, inP * 1.4) * (1 - out) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 52, background: "#15181a", boxShadow: `18px 22px 0 ${C.paper2}, 0 40px 80px -30px rgba(20,24,26,.5)` }} />
      <div style={{ position: "absolute", left: 10, top: 10, right: 10, bottom: 10, borderRadius: 43, overflow: "hidden", background: C.paper }}>
        <Img src={staticFile(`promo/shots/${shot}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%` }} />
      </div>
    </div>
  );
};

const Headline: React.FC<{ s: Scene; size?: number }> = ({ s, size = 90 }) => (
  <>
    {s.h.map((line, i) => (
      <Rise key={i} at={6 + i * 5} style={{ fontFamily: LATIN, fontSize: size, lineHeight: 1.12, color: i === s.h.length - 1 ? C.green : C.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{line}</Rise>
    ))}
  </>
);

const PhoneScene: React.FC<{ s: Scene; idx: number; dur: number }> = ({ s, idx, dur }) => {
  const f = useCurrentFrame();
  const out = interpolate(f, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <TopBar idx={idx} />
      <div style={{ position: "absolute", left: 96, top: 230, width: 1100, opacity: out }}>
        <Rise at={0} y={20} style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: C.amber, marginBottom: 26 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 32, border: `3px solid ${C.red}`, color: C.red, fontFamily: SERIF, fontWeight: 700, fontSize: 28, letterSpacing: 0, transform: "rotate(-8deg)", boxShadow: `inset 0 0 0 4px ${C.paper}, inset 0 0 0 5.5px ${C.red}` }}>{s.no}</span>
          {s.kicker}
        </Rise>
        <Headline s={s} />
        <Rise at={18} y={20} style={{ marginTop: 34, height: 3, width: 220, background: C.ink }}><span /></Rise>
        <Rise at={22} y={20} style={{ marginTop: 26, fontFamily: SERIF, fontWeight: 700, fontSize: 44, color: C.ink2 }}>{s.zh}</Rise>
      </div>
      <Phone shot={s.shot!} focus={s.focus || [0.5, 0.5]} dur={dur} />
    </AbsoluteFill>
  );
};

const Hook: React.FC<{ s: Scene; dur: number }> = ({ s, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = spring({ frame: f - 6, fps, config: { damping: 12, stiffness: 120 } });
  const out = interpolate(f, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const POS = [[110, 90], [520, 60], [980, 110], [1420, 70], [1560, 200], [120, 770], [560, 840], [1000, 780], [1300, 880], [820, 930]];
  const words = ["makan", "rumah", "sekolah", "belajar", "terima kasih", "selamat pagi", "kawan", "buku", "jalan", "cinta"];
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {words.map((w, i) => {
        const [x, y] = POS[i];
        const o = interpolate(f, [i * 3, i * 3 + 14], [0, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <span key={w} style={{ position: "absolute", left: x, top: y + Math.sin((f + i * 20) / 30) * 8, fontFamily: LATIN, fontStyle: "italic", fontSize: 54, color: C.ink, opacity: o }}>{w}</span>;
      })}
      <div style={{ position: "absolute", left: 150, top: 270 }}>
        <Headline s={s} size={132} />
        <Rise at={22} style={{ marginTop: 30, fontFamily: LATIN, fontStyle: "italic", fontSize: 56, color: C.ink2 }}>Tak tahu nak mula dari mana?</Rise>
      </div>
      <Img src={staticFile(`img/${s.bird}.png`)} style={{ position: "absolute", right: 130, bottom: 190, height: 520, transform: `scale(${b}) rotate(${(1 - b) * -12}deg)`, transformOrigin: "50% 100%" }} />
    </AbsoluteFill>
  );
};

const End: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = spring({ frame: f - 4, fps, config: { damping: 11, stiffness: 120 } });
  const box = spring({ frame: f - 30, fps, config: { damping: 15, stiffness: 120 } });
  const name = "马来语高频词";
  const typed = name.slice(0, Math.max(0, Math.min(name.length, Math.floor((f - 44) / 4))));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 150, top: 190 }}>
        <Headline s={s} size={132} />
        <div style={{ marginTop: 56, transform: `scale(${box})`, transformOrigin: "0 50%", opacity: Math.min(1, box * 1.5) }}>
          <div style={{ fontFamily: SANS, fontSize: 30, color: C.ink2, marginBottom: 16 }}>微信小程序搜索</div>
          <div style={{ display: "flex", alignItems: "center", width: 760, height: 112, borderRadius: 20, background: C.card, border: `4px solid ${C.ink}`, boxShadow: `10px 12px 0 ${C.paper2}`, padding: "0 30px", boxSizing: "border-box" }}>
            <span style={{ width: 34, height: 34, borderRadius: 20, border: `5px solid ${C.ink}`, marginRight: 26, flex: "none", position: "relative" }}><i style={{ position: "absolute", right: -14, bottom: -10, width: 16, height: 5, background: C.ink, transform: "rotate(45deg)", borderRadius: 3 }} /></span>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 54, color: C.ink }}>{typed}</span>
            <span style={{ width: 4, height: 56, background: C.amber, marginLeft: 6, opacity: Math.floor(f / 8) % 2 ? 1 : 0.2 }} />
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.card, background: C.green, padding: "12px 28px", borderRadius: 12 }}>搜索</span>
          </div>
        </div>
      </div>
      <Img src={staticFile(`img/${s.bird}.png`)} style={{ position: "absolute", right: 120, bottom: 200, height: 540, transform: `scale(${b}) rotate(${(1 - b) * 10}deg)`, transformOrigin: "50% 100%" }} />
    </AbsoluteFill>
  );
};

// 字幕：上面一行马来语原文（小），下面中文（大）
const Subs: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / PROMO_FPS;
  const { at } = promoTimeline();
  const l = LINES.find(x => t >= at[x.key][0] - 0.1 && t <= at[x.key][1] + 0.3);
  if (!l) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, textAlign: "center" }}>
      <div style={{ display: "inline-block", maxWidth: 1640, padding: "14px 38px 18px", borderRadius: 18, background: "rgba(28,36,32,.9)" }}>
        <div style={{ fontFamily: LATIN, fontStyle: "italic", fontSize: 28, color: "rgba(255,253,248,.72)", lineHeight: 1.3 }}>{l.ms}</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 42, color: "#fffdf8", lineHeight: 1.35, marginTop: 2 }}>{l.zh}</div>
      </div>
    </div>
  );
};

export const Promo: React.FC = () => {
  const { at, scenes, total } = promoTimeline();
  const F = (s: number) => Math.round(s * PROMO_FPS);
  const f = useCurrentFrame();
  const fadeOut = interpolate(f, [F(total) - 20, F(total)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Paper />
      {scenes.map((s, i) => {
        const dur = F(s.end) - F(s.start);
        return (
          <Sequence key={s.key} from={F(s.start)} durationInFrames={dur}>
            {s.kind === "hook" ? <Hook s={s} dur={dur} /> : s.kind === "end" ? <End s={s} /> : <PhoneScene s={s} idx={i - 1} dur={dur} />}
          </Sequence>
        );
      })}
      <Subs />
      {LINES.map(l => (
        <Sequence key={l.key} from={F(at[l.key][0])}><Audio src={staticFile(VO[l.key].file)} /></Sequence>
      ))}
      <Audio src={staticFile("v5k/bgm-long.mp3")} volume={fr => 0.1 * Math.min(1, fr / 20) * interpolate(fr, [F(total) - 45, F(total)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <AbsoluteFill style={{ background: C.paper, opacity: 1 - fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
