// Standard Remotion entry for opening this project in Remotion Studio locally
// (npm i remotion @remotion/cli three react react-dom; npx remotion studio src/index.ts).
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Video, SAMPLE_FRAMES } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="ZiYuXinShi" component={Video} durationInFrames={SAMPLE_FRAMES} fps={30} width={1920} height={1080} />
);

registerRoot(RemotionRoot);
