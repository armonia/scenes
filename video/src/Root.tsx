import "./index.css";
import { Composition } from "remotion";
import { PromptInput } from "./scenes/PromptInput";
import { FrameLockedProbe } from "./scenes/FrameLockedProbe";
import { UIMockup } from "./scenes/UIMockup";
import { CardHandoff } from "./scenes/CardHandoff";
import { CardFocus } from "./scenes/CardFocus";
import { CardRelease } from "./scenes/CardRelease";
import catalog from "./scenes/catalog.json";

/**
 * Le composition della vetrina NON sono scritte qui a mano: escono da
 * catalog.json, che e' lo stesso file letto dal workflow, dai banchi e dalla
 * pagina. Prima le quattro scene erano dichiarate in cinque posti diversi e
 * aggiungerne una voleva dire ricordarseli tutti; il posto dimenticato non
 * rompeva niente, faceva solo sparire la scena dal sito con la CI verde.
 *
 * L'unica riga che resta da scrivere per una scena nuova e' quella qui sotto,
 * che lega l'id al componente: un import non si puo' inventare da una stringa.
 * Se manca, il modulo non si carica e lo dice — meglio di una scena assente in
 * silenzio.
 */
const COMPONENTS: Record<string, React.FC> = {
  PromptInput,
  UIMockup,
  CardHandoff,
  CardFocus,
  CardRelease,
};

const missing = catalog.scenes.filter((s) => !COMPONENTS[s.id]);
if (missing.length > 0) {
  throw new Error(
    `catalog.json elenca scene senza componente: ${missing
      .map((s) => s.id)
      .join(", ")}. Aggiungile a COMPONENTS in Root.tsx.`,
  );
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {catalog.scenes.map((scene) => (
        <Composition
          key={scene.id}
          id={scene.id}
          component={COMPONENTS[scene.id]}
          durationInFrames={scene.durationInFrames}
          fps={scene.fps}
          width={scene.width}
          height={scene.height}
          defaultProps={{}}
        />
      ))}

      {/* I due banchi di prova di FrameLocked non sono scene della vetrina:
          stanno fuori dal catalogo apposta, non vanno renderizzate ne'
          pubblicate. Stessa scena, un solo flag di differenza, cosi' il
          confronto degli hash isola una variabile sola. */}
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
    </>
  );
};
