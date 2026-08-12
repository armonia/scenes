import "./index.css";
import { Composition } from "remotion";
import { OrbitLoop } from "./scenes/OrbitLoop";
import { PromptInput } from "./scenes/PromptInput";
import { FrameLockedProbe } from "./scenes/FrameLockedProbe";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromptInput"
        component={PromptInput}
        durationInFrames={390}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      {/* I due banchi di prova di FrameLocked. Stessa scena, un solo flag di
          differenza, cosi' il confronto degli hash isola una variabile sola. */}
      <Composition
        id="FrameLockedProbe"
        component={FrameLockedProbe}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ detachTicker: true }}
      />
      <Composition
        id="FrameLockedProbeAttached"
        component={FrameLockedProbe}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ detachTicker: false }}
      />

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
