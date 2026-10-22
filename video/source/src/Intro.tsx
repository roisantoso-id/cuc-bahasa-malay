// JomBelajar 竖屏介绍视频（9:16，约 57 秒，中文配音）
// 时间线按配音 manifest 排（promo-video skill）：每个场景 = 它那几句配音的时长 + 少量留白
// 风格沿用官网 C 版：米白底、绿主色、犀鸟吉祥物、圆角、弹出动效。只写个人身份，不以学校名义。
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import manifest from "../public/voice/manifest.json";

export const FPS = 30;
const M = manifest as Record<string, { file: string; sec: number; text: string }>;
const C = { green: "#2fae66", greenD: "#22874e", greenL: "#e7f7ee", yellow: "#ffc83d", blue: "#4aa8ff", blueD: "#2f86d6", coral: "#ff6b5a", bg: "#fafaf7", ink: "#20242a", ink2: "#5d646c", line: "#e8e8e2", navy: "#14213d" };
const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.25, 0.9, 0.25, 1);
const img = (n: string) => staticFile(`img/${n}`);

// ---------- 时间线 ----------
const PAD = 0.3; // 句与句之间留白(秒)
const SCENES: { id: string; lines: string[] }[] = [
  { id: "hook", lines: ["v01", "v02"] },
  { id: "easy", lines: ["v03"] },
  { id: "words", lines: ["v04"] },
  { id: "brand", lines: ["v05"] },
  { id: "teacher", lines: ["v06"] },
  { id: "study", lines: ["v07"] },
  { id: "read", lines: ["v08"] },
  { id: "quiz", lines: ["v09"] },
  { id: "media", lines: ["v10"] },
  { id: "cta", lines: ["v11", "v12"] },
];
type Line = { id: string; from: number; dur: number; text: string };
type Scene = { id: string; from: number; dur: number; lines: Line[] };
const LEAD = 0.4; // 片头留白
let cursor = LEAD;
const TIMELINE: Scene[] = SCENES.map((s) => {
  const from = cursor;
  const lines = s.lines.map((id) => {
    const l = { id, from: cursor, dur: M[id].sec, text: M[id].text };
    cursor += M[id].sec + PAD;
    return l;
  });
  return { id: s.id, from, dur: cursor - from, lines };
});
const TAIL = 1.2;
export const TOTAL_FRAMES = Math.ceil((cursor + TAIL) * FPS);
const f = (sec: number) => Math.round(sec * FPS);

// ---------- 通用小件 ----------
const usePop = (delay = 0, damping = 12) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140 } });
};

const Pop: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({ delay = 0, children, style, from = 60 }) => {
  const p = usePop(delay);
  return <div style={{ opacity: interpolate(p, [0, 0.4], [0, 1], clamp), transform: `translateY(${(1 - p) * from}px) scale(${0.85 + p * 0.15})`, ...style }}>{children}</div>;
};

// 场景整体淡入淡出
const SceneWrap: React.FC<{ dur: number; children: React.ReactNode; bg?: string }> = ({ dur, children, bg = C.bg }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8, f(dur) - 6, f(dur) + 4], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ background: bg, opacity: o, fontFamily: FONT, color: C.ink }}>{children}</AbsoluteFill>;
};

// 底部字幕(避开平台按钮:底部 230px、右侧 120px)
const Caption: React.FC<{ text: string; dark?: boolean }> = ({ text, dark }) => (
  <div style={{ position: "absolute", left: 60, right: 140, bottom: 250, textAlign: "center" }}>
    <span style={{ display: "inline", fontSize: 46, fontWeight: 800, lineHeight: 1.55, color: dark ? "#fff" : C.ink, background: dark ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.88)", padding: "6px 18px", borderRadius: 14, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{text}</span>
  </div>
);

const Kicker: React.FC<{ n: string; t: string; color?: string }> = ({ n, t, color = C.green }) => (
  <Pop><div style={{ fontSize: 34, fontWeight: 900, color, letterSpacing: 2 }}>{n} · {t}</div></Pop>
);

// 手机样机
const Phone: React.FC<{ title: string; children: React.ReactNode; scale?: number; style?: React.CSSProperties }> = ({ title, children, scale = 1, style }) => (
  <div style={{ width: 600 * scale, height: 1200 * scale, borderRadius: 86 * scale, padding: 22 * scale, background: "#16181c", boxShadow: "0 60px 120px -50px rgba(0,0,0,.5)", ...style }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 66 * scale, overflow: "hidden", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 70 * scale, display: "flex", justifyContent: "space-between", alignItems: "center", padding: `0 ${46 * scale}px`, fontSize: 26 * scale, fontWeight: 700 }}><span>9:41</span><span>●●●</span></div>
      <div style={{ height: 70 * scale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 * scale, fontWeight: 900 }}>{title}</div>
      <div style={{ flex: 1, padding: `${10 * scale}px ${34 * scale}px`, position: "relative" }}>{children}</div>
    </div>
  </div>
);

// ---------- 场景 ----------
const Hook: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const l2 = f(s.lines[1].from - s.from);
  const q = interpolate(frame, [l2, l2 + 10, l2 + 20], [1, 1.25, 1], clamp);
  return (
    <SceneWrap dur={s.dur}>
      <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center" }}>
        <Pop>
          <div style={{ display: "inline-block", position: "relative", background: "#fff", border: `6px solid ${C.ink}`, borderRadius: 60, padding: "40px 70px", fontSize: 130, fontWeight: 900, boxShadow: `0 14px 0 ${C.ink}` }}>
            Apa khabar?
            <div style={{ position: "absolute", left: 120, bottom: -46, width: 0, height: 0, borderLeft: "30px solid transparent", borderRight: "30px solid transparent", borderTop: `46px solid ${C.ink}` }} />
          </div>
        </Pop>
        {frame >= l2 && (
          <Pop delay={l2} style={{ marginTop: 120 }}>
            <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.3 }}>这句马来语，<br />你听懂了吗<span style={{ display: "inline-block", color: C.coral, transform: `scale(${q})` }}>？</span></div>
          </Pop>
        )}
      </div>
      <Pop delay={6} style={{ position: "absolute", bottom: 260, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={img("c-welcome.png")} style={{ width: 560 }} />
      </Pop>
    </SceneWrap>
  );
};

const Easy: React.FC<{ s: Scene }> = ({ s }) => {
  const d = f(s.dur);
  const items: [string, string, string][] = [["ABC", "用拉丁字母", C.blue], ["♪", "没有声调", C.yellow], ["闽", "很多词来自闽南话", C.coral]];
  return (
    <SceneWrap dur={s.dur}>
      <div style={{ position: "absolute", top: 220, left: 90, right: 90 }}>
        <Kicker n="01" t="其实不难" />
        <Pop delay={4}><div style={{ fontSize: 96, fontWeight: 900, margin: "20px 0 60px", lineHeight: 1.2 }}>马来语<br /><span style={{ background: `linear-gradient(transparent 60%, ${C.yellow} 60%)` }}>入门很快</span></div></Pop>
        {items.map(([ic, t, col], i) => (
          <Pop key={t} delay={Math.round(d * (0.12 + i * 0.22))}>
            <div style={{ display: "flex", alignItems: "center", gap: 36, background: "#fff", border: `5px solid ${C.line}`, borderRadius: 40, padding: "30px 40px", marginBottom: 30, boxShadow: `0 10px 0 ${C.line}` }}>
              <div style={{ width: 120, height: 120, borderRadius: 30, background: col, color: col === C.yellow ? C.ink : "#fff", display: "grid", placeItems: "center", fontSize: ic.length > 1 ? 46 : 60, fontWeight: 900 }}>{ic}</div>
              <div style={{ fontSize: 62, fontWeight: 900 }}>{t}</div>
            </div>
          </Pop>
        ))}
      </div>
      <Pop delay={d - 40} style={{ position: "absolute", right: 60, bottom: 380 }}><Img src={img("c-study.png")} style={{ width: 300 }} /></Pop>
      <Caption text={s.lines[0].text} />
    </SceneWrap>
  );
};

const Words: React.FC<{ s: Scene }> = ({ s }) => {
  const d = f(s.dur);
  const w: [string, string][] = [["teh", "茶"], ["tauhu", "豆腐"], ["mi", "面"]];
  return (
    <SceneWrap dur={s.dur} bg={C.greenL}>
      <div style={{ position: "absolute", top: 260, left: 90, right: 90 }}>
        <Kicker n="02" t="来自闽南话" color={C.greenD} />
        <div style={{ marginTop: 50 }}>
          {w.map(([ms, zh], i) => {
            const delay = Math.round(d * (0.05 + i * 0.3));
            return (
              <Pop key={ms} delay={delay} from={120}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "#fff", borderRadius: 44, padding: "46px 60px", marginBottom: 36, border: `5px solid ${C.green}`, boxShadow: `0 12px 0 ${C.greenD}` }}>
                  <span style={{ fontSize: 120, fontWeight: 900, color: C.greenD, fontFamily: "Avenir Next, Helvetica, sans-serif" }}>{ms}</span>
                  <span style={{ fontSize: 96, fontWeight: 900 }}>{zh}</span>
                </div>
              </Pop>
            );
          })}
        </div>
      </div>
      <Caption text={s.lines[0].text} />
    </SceneWrap>
  );
};

const Brand: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, f(s.dur)], [1.0, 1.08], clamp);
  return (
    <SceneWrap dur={s.dur}>
      <div style={{ position: "absolute", top: 260, left: 0, right: 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <Pop from={100}><Img src={img("c-hero.png")} style={{ width: 1080, transform: `scale(${z})`, marginLeft: -180 }} /></Pop>
      </div>
      <div style={{ position: "absolute", top: 1060, left: 90, right: 90 }}>
        <Pop delay={8}><div style={{ fontSize: 150, fontWeight: 900, color: C.green, fontFamily: "Avenir Next, Helvetica, sans-serif", letterSpacing: -2 }}>JomBelajar</div></Pop>
        <Pop delay={16}><div style={{ fontSize: 62, fontWeight: 900, marginTop: 10 }}>用中文学马来语的<br />微信小程序</div></Pop>
      </div>
    </SceneWrap>
  );
};

const BOOKS = ["tongyuan", "warisan", "poems", "newspaper", "literature", "writing"];
const Teacher: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const d = f(s.dur);
  const bookStart = Math.round(d * 0.42);
  return (
    <SceneWrap dur={s.dur} bg={C.navy}>
      <div style={{ position: "absolute", top: 200, left: 90, right: 90, color: "#fff" }}>
        <Kicker n="03" t="谁编的课" color={C.yellow} />
        <div style={{ display: "flex", gap: 50, marginTop: 40, alignItems: "flex-end" }}>
          <Pop from={80}>
            <div style={{ width: 400, height: 530, borderRadius: 36, overflow: "hidden", border: `8px solid ${C.yellow}` }}>
              <Img src={img("zhang.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(frame, [0, d], [1.08, 1], clamp)})` }} />
            </div>
          </Pop>
          <div style={{ flex: 1 }}>
            <Pop delay={8}><div style={{ fontSize: 110, fontWeight: 900 }}>张静灵</div></Pop>
            <Pop delay={14}><div style={{ fontSize: 44, fontWeight: 800, color: C.yellow, marginTop: 8 }}>副教授</div></Pop>
            <Pop delay={20}><div style={{ fontSize: 40, fontWeight: 700, color: "#cfd6e4", marginTop: 16, lineHeight: 1.4 }}>中国传媒大学<br />马来语专业教师</div></Pop>
            <Pop delay={26}><div style={{ display: "inline-block", marginTop: 24, fontSize: 38, fontWeight: 900, background: C.green, padding: "10px 24px", borderRadius: 18 }}>课程主持</div></Pop>
          </div>
        </div>
        <div style={{ marginTop: 90, fontSize: 40, fontWeight: 800, color: "#cfd6e4", opacity: interpolate(frame, [bookStart, bookStart + 10], [0, 1], clamp) }}>专著 · 译著 · 高校马来语教材</div>
        <div style={{ display: "flex", gap: 18, marginTop: 30 }}>
          {BOOKS.map((b, i) => (
            <Pop key={b} delay={bookStart + i * 5} from={160} style={{ flex: 1 }}>
              <Img src={img(`${b}.jpg`)} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 10, boxShadow: "0 24px 30px -18px rgba(0,0,0,.7)" }} />
            </Pop>
          ))}
        </div>
      </div>
      <Caption text={s.lines[0].text} dark />
    </SceneWrap>
  );
};

const Study: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const d = f(s.dur);
  const reveal = Math.round(d * 0.3);
  const pick = Math.round(d * 0.62);
  const rates: [string, string, string][] = [["重来", "1 分钟", C.coral], ["困难", "10 分钟", "#f5a524"], ["良好", "1 天", C.green], ["简单", "4 天", C.blue]];
  return (
    <SceneWrap dur={s.dur}>
      <div style={{ position: "absolute", top: 150, left: 90 }}><Kicker n="04" t="背单词" /></div>
      <Pop delay={4} style={{ position: "absolute", top: 240, left: 240 }}>
        <Phone title="学习新词">
          <div style={{ height: 22, borderRadius: 99, background: C.line, overflow: "hidden", margin: "10px 0 30px" }}><div style={{ height: "100%", width: `${interpolate(frame, [0, d], [35, 60], clamp)}%`, background: C.green }} /></div>
          <div style={{ textAlign: "center", fontSize: 96, fontWeight: 900, margin: "40px 0 20px" }}>khabar</div>
          <div style={{ textAlign: "center" }}><span style={{ fontSize: 24, fontWeight: 800, color: C.blueD, background: "#e4f1ff", padding: "8px 20px", borderRadius: 99 }}>▶ 单词音频</span></div>
          {frame < reveal ? (
            <div style={{ marginTop: 70, textAlign: "center", fontSize: 28, color: C.ink2 }}>先回忆它的含义，再显示答案。
              <div style={{ margin: "40px auto 0", width: 380, height: 84, borderRadius: 24, background: C.green, color: "#fff", display: "grid", placeItems: "center", fontSize: 32, fontWeight: 900, boxShadow: `0 8px 0 ${C.greenD}` }}>显示答案</div>
            </div>
          ) : (
            <Pop delay={reveal}>
              <div style={{ marginTop: 40, background: "#fff", border: `3px solid ${C.line}`, borderRadius: 28, padding: "24px 28px", fontSize: 30 }}>
                <b>名词</b>　消息；近况
                <div style={{ marginTop: 14, paddingLeft: 16, borderLeft: `6px solid ${C.yellow}`, color: C.ink2 }}><b style={{ color: C.ink }}>Apa khabar?</b><br />你好吗？</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 30 }}>
                {rates.map(([t, h, col], i) => {
                  const on = frame >= pick && i === 2;
                  return (
                    <div key={t} style={{ background: col, color: "#fff", borderRadius: 18, padding: "10px 0 14px", textAlign: "center", transform: on ? "scale(1.12)" : "none", boxShadow: on ? `0 0 0 6px ${C.ink}` : "none", transition: "none" }}>
                      <div style={{ fontSize: 18, opacity: 0.9 }}>{h}</div><div style={{ fontSize: 30, fontWeight: 900 }}>{t}</div>
                    </div>
                  );
                })}
              </div>
            </Pop>
          )}
          {frame >= pick && <Pop delay={pick}><div style={{ marginTop: 34, textAlign: "center", fontSize: 30, fontWeight: 900, color: C.greenD }}>✓ 1 天后再复习</div></Pop>}
        </Phone>
      </Pop>
      <Caption text={s.lines[0].text} />
    </SceneWrap>
  );
};

const Read: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const d = f(s.dur);
  const run = interpolate(frame, [0, d], [-300, 1100], clamp);
  return (
    <SceneWrap dur={s.dur}>
      <div style={{ position: "absolute", top: 150, left: 90 }}><Kicker n="05" t="读和听" color={C.blueD} /></div>
      <Pop delay={2} style={{ position: "absolute", top: 260, left: 90 }}>
        <Phone title="文章" scale={0.78}>
          <div style={{ fontSize: 34, fontWeight: 900, margin: "16px 0 20px" }}>Di kopitiam：在茶室点饮料</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: `3px solid ${C.line}`, borderRadius: 24, padding: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, background: C.green, color: "#fff", display: "grid", placeItems: "center", fontSize: 28 }}>❚❚</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800 }}>文章朗读</div><div style={{ height: 10, background: C.line, borderRadius: 9, marginTop: 10 }}><div style={{ height: "100%", width: `${interpolate(frame, [0, d], [5, 70], clamp)}%`, background: C.green, borderRadius: 9 }} /></div></div>
          </div>
          {["Pelayan: Nak minum apa?", "服务员：要喝什么？", "Ali: Teh tarik satu,", "kurang manis.", "阿里：一杯拉茶，少甜。"].map((t, i) => (
            <div key={t} style={{ fontSize: 26, margin: "18px 0", fontWeight: i % 2 === 0 ? 800 : 500, color: i % 2 === 0 ? C.ink : C.ink2 }}>{t}</div>
          ))}
        </Phone>
      </Pop>
      <Pop delay={Math.round(d * 0.45)} style={{ position: "absolute", top: 640, right: 90 }}>
        <Phone title="视频" scale={0.62}>
          <div style={{ height: 300, borderRadius: 20, background: "#20242a", display: "grid", placeItems: "center", color: "#fff", fontSize: 80, marginTop: 10 }}>▶</div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 24 }}>Di pasar：在菜市场</div>
          <div style={{ fontSize: 24, color: C.blueD, fontWeight: 800, marginTop: 14 }}>从上次的位置继续</div>
        </Phone>
      </Pop>
      <Img src={img("c-loading.png")} style={{ position: "absolute", bottom: 330, left: run, width: 300 }} />
      <Caption text={s.lines[0].text} />
    </SceneWrap>
  );
};

const Quiz: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const d = f(s.dur);
  const pick = Math.round(d * 0.25);
  const wrong = Math.round(d * 0.55);
  const opts = ["早上好", "你好吗？", "谢谢", "再见"];
  return (
    <SceneWrap dur={s.dur}>
      <div style={{ position: "absolute", top: 150, left: 90 }}><Kicker n="06" t="在线测试" /></div>
      <Pop delay={2} style={{ position: "absolute", top: 240, left: 240 }}>
        <Phone title="答题">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 800, color: C.ink2, marginTop: 10 }}><span>第 1 / 4 题</span><span>单选题 · 2 分</span></div>
          <div style={{ fontSize: 40, fontWeight: 900, margin: "30px 0 34px", lineHeight: 1.35 }}>「Apa khabar?」<br />是什么意思？</div>
          {opts.map((o, i) => {
            const right = frame >= pick && i === 1;
            return <div key={o} style={{ border: `4px solid ${right ? C.green : C.line}`, background: right ? C.greenL : "#fff", color: right ? C.greenD : C.ink, borderRadius: 26, padding: "22px 28px", fontSize: 32, fontWeight: 800, marginBottom: 18 }}>{o}{right ? "　✓" : ""}</div>;
          })}
          {frame >= pick && <Pop delay={pick}><div style={{ textAlign: "center", fontSize: 72, fontWeight: 900, color: C.green, marginTop: 20 }}>+2 分</div></Pop>}
        </Phone>
      </Pop>
      {frame >= wrong && (
        <Pop delay={wrong} style={{ position: "absolute", top: 1180, right: 70 }}>
          <div style={{ background: C.coral, color: "#fff", fontSize: 44, fontWeight: 900, padding: "22px 34px", borderRadius: 30, boxShadow: "0 10px 0 #d94a3a" }}>错题本 +1</div>
        </Pop>
      )}
      <Pop delay={wrong} style={{ position: "absolute", left: 40, top: 1080 }}><Img src={img("c-pass.png")} style={{ width: 300 }} /></Pop>
      <Caption text={s.lines[0].text} />
    </SceneWrap>
  );
};

const Media: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const d = f(s.dur);
  const z = interpolate(frame, [0, d], [1.0, 1.12], clamp);
  return (
    <SceneWrap dur={s.dur} bg="#111">
      <div style={{ position: "absolute", top: 180, left: 90, right: 90, color: "#fff" }}>
        <Kicker n="07" t="团队成员" color={C.yellow} />
        <Pop delay={6}><div style={{ fontSize: 100, fontWeight: 900, marginTop: 20 }}>杨启航</div></Pop>
        <Pop delay={12}><div style={{ fontSize: 40, fontWeight: 700, color: "#cfd6e4", marginTop: 8 }}>中国传媒大学马来语专业本科生</div></Pop>
      </div>
      <Pop delay={8} style={{ position: "absolute", top: 600, left: 40, right: 40 }}>
        <div style={{ borderRadius: 30, overflow: "hidden", border: "6px solid #fff" }}>
          <Img src={img("rtm-live.jpg")} style={{ width: "100%", display: "block", transform: `scale(${z})`, transformOrigin: "45% 40%" }} />
        </div>
        <div style={{ color: "#fff", fontSize: 38, fontWeight: 800, marginTop: 24, maxWidth: 560 }}>马来西亚国家广播电视台 RTM<br /><span style={{ color: C.yellow }}>《早安马来西亚》直播访谈</span></div>
      </Pop>
      <Pop delay={Math.round(d * 0.45)} style={{ position: "absolute", top: 1200, right: 140 }}>
        <Img src={img("rtm-poster.jpg")} style={{ width: 280, borderRadius: 18, transform: "rotate(4deg)", boxShadow: "0 30px 40px -20px rgba(0,0,0,.8)" }} />
      </Pop>
      <Caption text={s.lines[0].text} dark />
    </SceneWrap>
  );
};

const Cta: React.FC<{ s: Scene }> = ({ s }) => {
  const frame = useCurrentFrame();
  const l2 = f(s.lines[1].from - s.from);
  return (
    <SceneWrap dur={s.dur + TAIL}>
      <div style={{ position: "absolute", top: 260, left: 90, right: 90, color: C.ink }}>
        <Pop><div style={{ fontSize: 50, fontWeight: 900, color: C.green }}>每天十分钟</div></Pop>
        <Pop delay={6}><div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1.15, marginTop: 10 }}>开口说<br />马来语</div></Pop>
        {frame >= l2 && <Pop delay={l2} from={100}><div style={{ display: "inline-block", marginTop: 40, fontSize: 110, fontWeight: 900, color: C.ink, background: C.yellow, padding: "10px 40px", borderRadius: 40, transform: "rotate(-3deg)", fontFamily: "Avenir Next, Helvetica, sans-serif" }}>Jom belajar!</div></Pop>}
      </div>
      <Pop delay={10} style={{ position: "absolute", right: 30, bottom: 520 }}><Img src={img("c-cheer.png")} style={{ width: 600 }} /></Pop>
      <Pop delay={18} style={{ position: "absolute", left: 90, bottom: 300 }}>
        <div style={{ color: C.green, fontSize: 60, fontWeight: 900, fontFamily: "Avenir Next, Helvetica, sans-serif" }}>JomBelajar</div>
        <div style={{ color: C.ink, fontSize: 44, fontWeight: 800, marginTop: 6 }}>www.bahasa.cn</div>
      </Pop>
    </SceneWrap>
  );
};

const VIEWS: Record<string, React.FC<{ s: Scene }>> = { hook: Hook, easy: Easy, words: Words, brand: Brand, teacher: Teacher, study: Study, read: Read, quiz: Quiz, media: Media, cta: Cta };

export const Intro: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    {TIMELINE.map((s, i) => {
      const V = VIEWS[s.id];
      const last = i === TIMELINE.length - 1;
      return (
        <Sequence key={s.id} from={f(s.from)} durationInFrames={f(s.dur + (last ? TAIL : 0.4))}>
          <V s={s} />
        </Sequence>
      );
    })}
    {TIMELINE.flatMap((s) => s.lines).map((l) => (
      <Sequence key={l.id} from={f(l.from)} durationInFrames={f(l.dur) + 2}>
        <Audio src={staticFile(`voice/${M[l.id].file}`)} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
