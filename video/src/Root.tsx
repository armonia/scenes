import "./index.css";
import { Composition } from "remotion";
import { PromptInput } from "./scenes/PromptInput";
import { FrameLockedProbe } from "./scenes/FrameLockedProbe";
import { UIMockup } from "./scenes/UIMockup";

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
        id="UIMockup"
        component={UIMockup}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
