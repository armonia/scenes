/**
 * Lo scambio che il thread dell'assistente mostra gia' prima che la scena
 * cominci: due domande, due risposte, e la lettura di un file.
 *
 * Stava scritto dentro Assistant.tsx. E' qui, in un modulo puro, perche' beats.py
 * legge il render con l'OCR e deve sapere quali parole c'erano gia' in quadro:
 * "solo" sta nella risposta che arriva in streaming e anche in questa storia, e
 * contarla voleva dire trovare la risposta prima che arrivasse.
 *
 * Modulo puro, letto da Node.
 */
export type ThreadItem =
  | { kind: "msg"; who: "user" | "assistant"; text: string }
  | { kind: "tool"; file: string };

export const THREAD_HISTORY: ThreadItem[] = [
  { kind: "msg", who: "user", text: "Prendi i quattro commercial e dimmi cosa fanno davvero." },
  {
    kind: "msg",
    who: "assistant",
    text: "Su quattro, solo i due Linear sono motion graphics. Cursor e Raycast sono girati con una camera: attore, luce calda, mani vere. Quelli non si replicano in codice.",
  },
  { kind: "tool", file: "ref/sheet_ovxL42LkKNg.jpg" },
  { kind: "msg", who: "user", text: "Fammi vedere la board con la card attiva." },
  {
    kind: "msg",
    who: "assistant",
    text: "Fatto. Kanban aperto, la card attiva e' UIMockup: piano 3D piu' parallasse, e il pannello mostra branch e assegnatario.",
  },
];
