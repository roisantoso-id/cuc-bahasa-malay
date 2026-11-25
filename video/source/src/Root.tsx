import React from "react";
import { Composition } from "remotion";
import { Intro, TOTAL_FRAMES, FPS } from "./Intro";
import { V5k, V5kCover, totalFrames } from "./V5k";
import { Promo, promoFrames, PROMO_FPS } from "./Promo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Intro" component={Intro} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 小红书讲解:5000 高频词怎么背(犀鸟讲五步) */}
    <Composition id="V5k" component={V5k} durationInFrames={totalFrames()} fps={30} width={1080} height={1920} />
    <Composition id="V5k-cover" component={V5kCover} durationInFrames={1} fps={30} width={1080} height={1440} />
    {/* 横屏宣传片:全马来语旁白 + 中文字幕,白天「旅行手账」版真实截图 */}
    <Composition id="Promo" component={Promo} durationInFrames={promoFrames()} fps={PROMO_FPS} width={1920} height={1080} />
  </>
);
