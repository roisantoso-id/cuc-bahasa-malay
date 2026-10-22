import React from "react";
import { Composition } from "remotion";
import { Intro, TOTAL_FRAMES, FPS } from "./Intro";

export const RemotionRoot: React.FC = () => (
  <Composition id="Intro" component={Intro} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);
