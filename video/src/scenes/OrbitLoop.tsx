import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

/**
 * Orbit loop — an abstract instrument scene.
 *
 * Rings on genuinely different axes, so they cross each other and read as a
 * mechanism rather than as concentric ellipses. Each carries a graduated dial,
 * labels lying on its own plane, and a light head dragging a wake. One
 * continuous take: nothing cuts, the assembly turns and collapses into the mark.
 *
 * Frame-locked: every value comes from useCurrentFrame(), so it renders
 * deterministically. No CSS animation, no requestAnimationFrame.
 */

export type OrbitLoopProps = {
  steps: string[];
  wordmark: string;
  tagline: string;
  accent: string;
};

const SIZE = 1080;
const C = SIZE / 2;

const circlePath = (r: number) =>
  `M ${C - r},${C} a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 ${-r * 2},0`;

type RingSpec = {
  r: number;
  /** Tilt away from the viewer. */
  rx: number;
  /** Yaw, so rings do not share a plane. */
  ry: number;
  /** Turn rate in degrees per second, signed. */
  spin: number;
  /** Head speed in laps per second. */
  lap: number;
  /** Phase offset so heads never line up into a spoke. */
  phase: number;
  labels: string[];
  /** Far rings sit back: dimmer and softer. */
  depth: number;
};

const Ring: React.FC<{
  spec: RingSpec;
  index: number;
  frame: number;
  fps: number;
  accent: string;
  collapse: number;
}> = ({ spec, index, frame, fps, accent, collapse }) => {
  const id = `ring-${index}`;
  const t = frame / fps;

  const head = (((t * spec.lap + spec.phase) % 1) + 1) % 1;
  const angle = head * Math.PI * 2 - Math.PI / 2;
  const hx = C + Math.cos(angle) * spec.r;
  const hy = C + Math.sin(angle) * spec.r;

  const wake = 0.16;
  const ticks = Math.round(spec.r / 5);
  const dim = 1 - spec.depth * 0.45;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{
        position: "absolute",
        inset: 0,
        margin: "auto",
        width: "100%",
        height: "100%",
        overflow: "visible",
        transform: `rotateX(${spec.rx}deg) rotateY(${spec.ry}deg) rotateZ(${
          t * spec.spin
        }deg) scale(${collapse})`,
        transformOrigin: "50% 50%",
        filter: spec.depth > 0.5 ? `blur(${spec.depth * 2.4}px)` : undefined,
      }}
    >
      <defs>
        <path id={id} d={circlePath(spec.r)} />
        <filter id={`glow-${index}`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* The orbit: present, not shouting. */}
      <use
        href={`#${id}`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.3 * dim}
        strokeWidth={1.4}
      />

      {/* Graduations — the detail that makes it an instrument, not a circle. */}
      {Array.from({ length: ticks }).map((_, i) => {
        const a = (i / ticks) * Math.PI * 2;
        const major = i % 6 === 0;
        const len = major ? 20 : 9;
        const r0 = spec.r - len / 2;
        const r1 = spec.r + len / 2;
        return (
          <line
            key={i}
            x1={C + Math.cos(a) * r0}
            y1={C + Math.sin(a) * r0}
            x2={C + Math.cos(a) * r1}
            y2={C + Math.sin(a) * r1}
            stroke="#ffffff"
            strokeOpacity={(major ? 0.62 : 0.26) * dim}
            strokeWidth={major ? 1.7 : 1}
          />
        );
      })}

      {/* The wake: a bright arc chasing the head around the orbit. */}
      <use
        href={`#${id}`}
        fill="none"
        stroke={accent}
        strokeOpacity={0.95 * dim}
        strokeWidth={3.4}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${wake} ${1 - wake}`}
        strokeDashoffset={-head + wake}
        filter={`url(#glow-${index})`}
      />

      {/* The head itself. */}
      <circle
        cx={hx}
        cy={hy}
        r={5.5}
        fill={accent}
        opacity={dim}
        filter={`url(#glow-${index})`}
      />

      {/* Labels lie on the ring's own plane, so its tilt foreshortens them. */}
      {spec.labels.map((label, i) => (
        <text
          key={label}
          fill="#ffffff"
          fillOpacity={0.9 * dim}
          fontSize={22}
          letterSpacing={6}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          <textPath
            href={`#${id}`}
            startOffset={`${(i / Math.max(spec.labels.length, 1)) * 100 + 4}%`}
          >
            {label.toUpperCase()}
          </textPath>
        </text>
      ))}
    </svg>
  );
};

export const OrbitLoop: React.FC<OrbitLoopProps> = ({
  steps,
  wordmark,
  tagline,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const collapseStart = durationInFrames - 62;
  const collapse = interpolate(
    frame,
    [collapseStart, durationInFrames - 20],
    [1, 0.04],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.72, 0, 0.16, 1),
    },
  );
  const ringsOut = interpolate(
    frame,
    [durationInFrames - 36, durationInFrames - 22],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const markIn = interpolate(
    frame,
    [durationInFrames - 42, durationInFrames - 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const taglineIn = interpolate(
    frame,
    [durationInFrames - 28, durationInFrames - 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // The camera never sits still and never cuts: a slow push with a light drift.
  const push = interpolate(frame, [0, durationInFrames], [0.78, 1.16], {
    easing: Easing.bezier(0.35, 0, 0.5, 1),
  });
  const driftX = Math.sin(t * 0.31) * 4;
  const driftY = Math.cos(t * 0.24) * 5;

  const rings: RingSpec[] = [
    {
      r: 470, rx: 66, ry: 4, spin: 5.5, lap: 0.15, phase: 0.0,
      labels: steps.slice(0, 3), depth: 0.9,
    },
    {
      r: 372, rx: 54, ry: -34, spin: -7.5, lap: 0.19, phase: 0.42,
      labels: steps.slice(3, 6), depth: 0.35,
    },
    {
      r: 262, rx: 74, ry: 28, spin: 10.5, lap: 0.26, phase: 0.75,
      labels: steps.slice(6, 8), depth: 0,
    },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 50% 42% at 50% 50%, rgba(255,255,255,0.09), transparent 72%)",
        }}
      />

      <AbsoluteFill
        style={{
          opacity: fadeIn * ringsOut,
          perspective: 1400,
          perspectiveOrigin: "50% 50%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: SIZE,
            height: SIZE,
            transformStyle: "preserve-3d",
            transform: `scale(${push}) rotateX(${driftY}deg) rotateY(${driftX}deg)`,
          }}
        >
          {rings.map((spec, i) => (
            <Ring
              key={spec.r}
              spec={spec}
              index={i}
              frame={frame}
              fps={fps}
              accent={accent}
              collapse={collapse}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* Hand-off: the mark arrives while the rings are still shrinking. */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            opacity: markIn,
            transform: `scale(${interpolate(markIn, [0, 1], [0.93, 1])})`,
            color: "#ffffff",
            fontSize: 78,
            letterSpacing: -2,
            fontFamily:
              "Inter, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif",
            fontWeight: 500,
          }}
        >
          {wordmark}
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 24,
            letterSpacing: 0.3,
            fontFamily:
              "Inter, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif",
            opacity: taglineIn * 0.6,
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>

      {/* Grain: what stops a black frame reading as dead pixels.
          Drawn as an inline <svg> rather than a background-image on purpose. A
          background-image is fetched, and a frame can be captured before the
          fetch lands, which shows up as one grainless frame in the middle of a
          render. An element in the tree is painted with the frame. */}
      <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id="orbit-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves={3}
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#orbit-grain)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
