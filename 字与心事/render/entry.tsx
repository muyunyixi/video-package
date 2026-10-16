// Render harness: the composition is driven through Remotion's <Player>,
// frame by frame, and captured by render.mjs.
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { Video, SAMPLE_FRAMES } from "../src/Video";

const App = () => {
  const ref = useRef<PlayerRef>(null);
  useEffect(() => {
    (window as any).seek = (f: number) =>
      new Promise<void>((res) => {
        ref.current?.seekTo(f);
        requestAnimationFrame(() => requestAnimationFrame(() => res()));
      });
    (window as any).ready = true;
  }, []);
  return (
    <Player
      ref={ref}
      component={Video}
      durationInFrames={SAMPLE_FRAMES}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      style={{ width: 1920, height: 1080 }}
      controls={false}
      acknowledgeRemotionLicense
    />
  );
};

const fonts = [
  document.fonts.load('100px "HW"', "字与心事掂量"),
  document.fonts.load('300 20px "Noto Sans CJK SC"', "输入中"),
  document.fonts.load('400 20px "Noto Sans CJK SC"', "输入中"),
  document.fonts.load('500 20px "Noto Sans CJK SC"', "123"),
];
Promise.all(fonts).then(() => createRoot(document.getElementById("root")!).render(<App />));
