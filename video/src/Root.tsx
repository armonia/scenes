import "./index.css";
import { Composition } from "remotion";
import { OrbitLoop } from "./scenes/OrbitLoop";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OrbitLoop"
        component={OrbitLoop}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          steps: [
            "issue enters triage",
            "find bug labels",
            "search context",
            "start coding session",
            "draft root cause analysis",
            "review issues",
            "create follow-up issues",
            "issue moved to done",
          ],
          wordmark: "Armonia",
          tagline: "Every loop, closed.",
          accent: "#ffffff",
        }}
      />
    </>
  );
};
