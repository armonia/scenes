/**
 * I token del tema scuro di Topics, non un navy inventato.
 *
 * Sorgente di verita': il blocco `.dark` di `client/src/index.css` nel repo
 * dell'app, gia' trascritto una volta in `landing/public/v3.css` come `--app-*`.
 * Sono tenuti in hsl() come li scrive l'app, cosi' un diff col prodotto e' un
 * confronto fra stringhe e non una conversione da rifare a mano.
 *
 * Quello che rende una scena "la app" invece che un disegno DELLA app non e'
 * solo la tinta. Sono i raggi 8/6/4 (nessuno disegna 3/5/7) e il font di
 * sistema: un client desktop rende in -apple-system, mai in un display face.
 */

export const app = {
  bg: "hsl(222 16% 8.5%)",
  surface: "hsl(222 14% 11%)",
  elevated: "hsl(220 13% 14%)",
  hover: "hsl(220 12% 17%)",
  inset: "hsl(222 15% 10%)",
  border: "hsl(220 11% 18%)",
  borderLight: "hsl(220 10% 24%)",

  text: "#e6e8ec",
  textHeading: "#ccced4",
  textSecondary: "#aab0ba",
  textTertiary: "#969ca6",
  textMuted: "#8a9099",
  textFaint: "#7d838d",

  primary: "#4d94ff",
  claude: "#d97757",
  ok: "#34d399",
} as const;

/** --radius piu' i due calc. Otto, sei, quattro. */
export const radius = { md: 8, sm: 6, xs: 4 } as const;

export const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

export const monoStack =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/**
 * Il livello attenuato dietro sta a 0,62, non a 0,40.
 * Misurato: sotto quella soglia non legge come profondita', legge come rumore,
 * perche' il contenuto attenuato scende sotto 3:1 da renderizzato.
 */
/**
 * Il piano attenuato dietro la lastra, in tutte e cinque le scene.
 *
 * Erano quattro numeri scritti a mano in UIMockup, CardHandoff e CardFocus,
 * identici in tutti e tre i file e senza un nome. Tre copie di una costante
 * restano uguali finche' nessuno tocca una delle tre, che e' lo stesso motivo
 * per cui le pose di camera vivono in slab.ts.
 *
 * C'ERA ANCHE UN `BACKDROP_OPACITY` a 0,62, e non c'e' piu'. Serviva a
 * PromptInput, che aveva un fondo suo dietro una lastra sua; da quando anche
 * quella scena sta sulla lastra condivisa non la legge piu' nessuno. Una
 * costante che nessuna scena usa e' una proposta travestita da fatto, e il
 * numero 0,62 vive adesso dove e' sempre stato davvero: nel catalogo, come
 * misura di una cosa che nessuna scena fa ancora.
 */
export const SLAB_BACKDROP = {
  perspective: 3200,
  perspectiveOrigin: "50% 46%",
  opacity: 0.45,
  blur: 14,
} as const;
