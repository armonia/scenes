import "./index.css";
import { Composition } from "remotion";
import { PromptInput } from "./products/topics/scenes/PromptInput";
import { FrameLockedProbe } from "./scenes/FrameLockedProbe";
import { UIMockup } from "./products/topics/scenes/UIMockup";
import { CardHandoff } from "./products/topics/scenes/CardHandoff";
import { CardFocus } from "./products/topics/scenes/CardFocus";
import { CardRelease } from "./products/topics/scenes/CardRelease";
import { BoardOrbit } from "./products/topics/scenes/BoardOrbit";
import catalog from "./scenes/catalog.json";
import { SpecimenCam06 } from "./specimens/SpecimenCam06";
import { CAM06_SPECIMENS } from "./specimens/list";
import { STAGES, variantName, type Ratio } from "./kit/stage";
import { chainOrder, filmFrames, filmWindows } from "./kit/film";
import { SceneWindow } from "./kit/SceneWindow";
import { DemoFilm } from "./products/demo/DemoFilm";
import { DEMO_FRAMES } from "./products/demo/geometry";

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

const RATIOS = catalog.ratios as Ratio[];

/**
 * IL FILM: le stesse scene una dopo l'altra in una composition sola, ognuna
 * nella sua finestra. Non va in vetrina; esiste perche' i film di prodotto sono
 * fatti cosi', e `film-identity.sh` misura che un fotogramma del film sia lo
 * stesso della scena presa da sola. L'ordine e' quello delle giunte
 * (`seamAfter`), non quello in cui le scene sono scritte nel catalogo.
 */
const FILM = filmWindows(chainOrder(catalog.scenes));
const FILM_FPS = catalog.scenes[0]?.fps ?? 30;
if (catalog.scenes.some((s) => s.fps !== FILM_FPS)) {
  throw new Error("le scene del film hanno fps diversi: una finestra non puo' cambiare velocita'");
}

const TopicsFilm: React.FC = () => (
  <>
    {FILM.map((w) => {
      const Scene = COMPONENTS[w.id] as React.FC;
      return (
        <SceneWindow key={w.id} window={w}>
          <Scene />
        </SceneWindow>
      );
    })}
  </>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Una composition per scena e per rapporto. Il 16:9 tiene l'id di
          sempre; le altre lo portano come suffisso (kit/stage.ts, variantName).
          Le dimensioni vengono dallo stage, e la scena sceglie le pose del suo
          rapporto leggendole da useVideoConfig. */}
      {RATIOS.map((ratio) =>
        catalog.scenes.map((scene) => (
          <Composition
            key={variantName(scene.id, ratio)}
            id={variantName(scene.id, ratio)}
            component={COMPONENTS[scene.id]}
            durationInFrames={scene.durationInFrames}
            fps={scene.fps}
            width={STAGES[ratio].w}
            height={STAGES[ratio].h}
            defaultProps={{}}
          />
        )),
      )}

      {/* IL FILM DI ESEMPIO: Registro, un prodotto inventato, 45 secondi in una
          ripresa sola, costruito solo con i pezzi del kit. E' la prova che un
          commercial si produce senza scrivere animazioni da capo. */}
      {RATIOS.map((ratio) => (
        <Composition
          key={variantName("DemoFilm", ratio)}
          id={variantName("DemoFilm", ratio)}
          component={DemoFilm}
          durationInFrames={DEMO_FRAMES}
          fps={30}
          width={STAGES[ratio].w}
          height={STAGES[ratio].h}
        />
      ))}

      {RATIOS.map((ratio) => (
        <Composition
          key={variantName("TopicsFilm", ratio)}
          id={variantName("TopicsFilm", ratio)}
          component={TopicsFilm}
          durationInFrames={filmFrames(FILM)}
          fps={FILM_FPS}
          width={STAGES[ratio].w}
          height={STAGES[ratio].h}
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
      {/* PROVINI DEL TEMPO, non scene: non vanno in vetrina e nessuno le
          renderizza per il film. Sono le stesse scene a durata dimezzata e a
          due terzi, in ogni rapporto, e servono a tempo.py per provare che
          accorciare la durata accorcia OGNI battuta dentro la scena, e che le
          soglie percettive invece non si muovono. L'elenco sta in
          catalog.json (tempoFixtures). */}
      {RATIOS.map((ratio) =>
        catalog.tempoFixtures.map((f) => (
          <Composition
            key={variantName(f.id, ratio)}
            id={variantName(f.id, ratio)}
            component={COMPONENTS[f.scene]}
            durationInFrames={f.durationInFrames}
            fps={FILM_FPS}
            width={STAGES[ratio].w}
            height={STAGES[ratio].h}
          />
        )),
      )}
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
