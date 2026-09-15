import "./index.css";
import { Composition } from "remotion";
import { PromptInput } from "./scenes/PromptInput";
import { FrameLockedProbe } from "./scenes/FrameLockedProbe";
import { UIMockup } from "./scenes/UIMockup";
import { CardHandoff } from "./scenes/CardHandoff";
import { CardFocus } from "./scenes/CardFocus";
import { CardRelease } from "./scenes/CardRelease";
import { BoardOrbit } from "./scenes/BoardOrbit";
import catalog from "./scenes/catalog.json";
import { SpecimenCam06 } from "./specimens/SpecimenCam06";
import { CAM06_SPECIMENS } from "./specimens/list";

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
  BoardOrbit,
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
      {/* PROVINI DEL TEMPO, non scene: non stanno in catalog.json, quindi non
          vanno in vetrina e nessuno le renderizza per il film. Sono le stesse
          due scene a durata dimezzata e a due terzi, e servono a tempo.sh per
          provare che accorciare la durata accorcia OGNI battuta dentro la
          scena, e che le soglie percettive invece non si muovono. Senza un
          render veloce da misurare, "il tempo si puo' cambiare" resterebbe una
          frase nel README. */}
      <Composition
        id="CardHandoffFast"
        component={CardHandoff}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PromptInputFast"
        component={PromptInput}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
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
      {/* LA SONDA CHE IL BANCO DEVE BOCCIARE. Stessa scena delle due sopra, con
          un Math.random dentro: framelocked-verdict.sh deve uscire 1 su questa,
          e la CI lo verifica. Fino a settembre 2026 il banco stampava il
          verdetto e usciva sempre 0, quindi una divergenza vera sarebbe passata
          col verde. */}
      <Composition
        id="FrameLockedProbeRandom"
        component={FrameLockedProbe}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ detachTicker: true, jitter: true }}
      />
      {/* GLI SPECIMEN: una voce del registro su piu' lastre e piu' rapporti,
          per i banchi e non per la vetrina. L'elenco sta in specimens/list.ts,
          lo stesso che legge il manifest di drift.py. */}
      {CAM06_SPECIMENS.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={SpecimenCam06}
          durationInFrames={s.durationInFrames}
          fps={s.fps}
          width={s.width}
          height={s.height}
          defaultProps={{ product: s.product, ratio: s.ratio }}
        />
      ))}
    </>
  );
};
