import React, { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { W, H } from "./util";

export type SceneHandle = { render: (absFrame: number) => void; dispose?: () => void };
export type SceneFactory = (renderer: THREE.WebGLRenderer) => SceneHandle;

/**
 * Same mechanism as @remotion/three's <ThreeCanvas>: the Remotion frame drives
 * the scene, and the frame is drawn synchronously before the browser paints.
 */
export const ThreeLayer: React.FC<{ create: SceneFactory; from: number; style?: React.CSSProperties }> = ({ create, from, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const frame = useCurrentFrame();

  useLayoutEffect(() => {
    if (!handle.current) {
      const r = new THREE.WebGLRenderer({
        canvas: ref.current!,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      r.setPixelRatio(1);
      r.setSize(W, H, false);
      r.outputColorSpace = THREE.SRGBColorSpace;
      renderer.current = r;
      handle.current = create(r);
    }
    handle.current.render(frame + from);
  }, [frame]);

  useEffect(
    () => () => {
      handle.current?.dispose?.();
      renderer.current?.dispose();
      renderer.current?.forceContextLoss();
      handle.current = null;
    },
    []
  );

  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...style }} />;
};
