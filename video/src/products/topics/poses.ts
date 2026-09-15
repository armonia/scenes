import { STAGES } from "../../kit/stage.ts";
import type { Ratio } from "../../kit/stage.ts";
import { unprojectFrontal } from "../../kit/project.ts";
import {
  BOARD_PAD_X,
  MSG_MAX_W,
  MSG_TEXT_X,
  SIDEBAR_W,
  THREAD_PAD_X,
  TOOL_ROW_EXTRA_W,
  TOOL_ROW_INDENT,
  TOOL_ROW_MAX_W,
  TOPICS_RIG,
  TOPICS_SLAB,
  USER_BUBBLE_EXTRA_W,
  BOARD_ORBIT_END_POSE,
  CARD_FOCUS_END_POSE,
  CARD_HANDOFF_END_POSE,
  CARD_RELEASE_END_POSE,
  PROMPT_INPUT_END_POSE,
  UI_MOCKUP_END_POSE,
  UI_MOCKUP_START_POSE,
} from "./geometry.ts";
import type { CameraPose } from "./geometry.ts";

/**
 * Le sette pose della catena di Topics, per rapporto.
 *
 * IL 16:9 SONO LE POSE DI SEMPRE, gli stessi oggetti di geometry.ts: i render
 * pubblicati non cambiano di un pixel, e still-identity.sh lo misura.
 *
 * IL 9:16 E IL 4:5 SONO DERIVATI, e sono scritti qui come dati invece di essere
 * ricalcolati a ogni render per due motivi. Il calcolo e' una ricerca (una
 * scansione sullo zoom e una ricerca a pattern sullo spostamento), e rifarla in
 * ogni scheda di Chromium costerebbe secondi e potrebbe dare l'ultima cifra
 * diversa da quella che vedono i banchi in Node. E una posa, una volta
 * guardata, si puo' voler ritoccare a mano: le pose restano dati del film.
 * Da dove vengono lo dice la regola in derive.ts, e `poses-check.py` verifica
 * che questa tabella coincida con quello che la regola produce.
 *
 * LA REGOLA, in breve (derive.ts la scrive per intero):
 *  - yaw e pitch restano quelli del 16:9, quindi il verso della camera lungo la
 *    catena non cambia;
 *  - lo zoom segue lo stesso rapporto di spinta fra una posa e la successiva
 *    misurato sul 16:9, alzato quanto basta perche' la lastra copra il quadro;
 *  - il soggetto di ogni posa resta tutto in quadro: la colonna "In corso" alla
 *    fine di UIMockup, la card consegnata in CardHandoff, la sua parte con tag e
 *    titolo in CardFocus, intestazione del thread e testo del prompt in
 *    PromptInput;
 *  - l'ingresso di UIMockup e il bordo lontano di BoardOrbit cadono alla stessa
 *    frazione della larghezza del quadro in cui cadono nel 16:9.
 */
export type TopicsPoses = {
  UI_MOCKUP_START_POSE: CameraPose;
  UI_MOCKUP_END_POSE: CameraPose;
  CARD_HANDOFF_END_POSE: CameraPose;
  CARD_FOCUS_END_POSE: CameraPose;
  CARD_RELEASE_END_POSE: CameraPose;
  PROMPT_INPUT_END_POSE: CameraPose;
  BOARD_ORBIT_END_POSE: CameraPose;
};

export const TOPICS_POSES: Record<Ratio, TopicsPoses> = {
  "16x9": {
    UI_MOCKUP_START_POSE,
    UI_MOCKUP_END_POSE,
    CARD_HANDOFF_END_POSE,
    CARD_FOCUS_END_POSE,
    CARD_RELEASE_END_POSE,
    PROMPT_INPUT_END_POSE,
    BOARD_ORBIT_END_POSE,
  },
  "9x16": {
    UI_MOCKUP_START_POSE: { yaw: -18, pitch: 5, pushZ: 1078.1871018181423, slideX: 1083.8090526268718, slideY: -33.59999999999998 },
    UI_MOCKUP_END_POSE: { yaw: -9, pitch: 2.5, pushZ: 1106.2821091691922, slideX: 47.384363717619365, slideY: -33.59999999999998 },
    CARD_HANDOFF_END_POSE: { yaw: -4, pitch: 1.2, pushZ: 1134.377116520242, slideX: -504.1675631193945, slideY: -33.59999999999998 },
    CARD_FOCUS_END_POSE: { yaw: 0, pitch: 0, pushZ: 1493.6170212765958, slideX: -432.24056737588666, slideY: 126.00000000000004 },
    CARD_RELEASE_END_POSE: { yaw: 0, pitch: 0, pushZ: 913.5145325111718, slideX: 0, slideY: -26.984190912540555 },
    PROMPT_INPUT_END_POSE: { yaw: 0, pitch: 0, pushZ: 1171.1476096614467, slideX: 633.1812068417728, slideY: -131.01763142191854 },
    BOARD_ORBIT_END_POSE: { yaw: -34, pitch: 3.2, pushZ: 741.1729518918756, slideX: 634.420960745726, slideY: -33.59999999999998 },
  },
  "4x5": {
    UI_MOCKUP_START_POSE: { yaw: -18, pitch: 5, pushZ: 393.3781826108417, slideX: 1046.7912041341715, slideY: -10.799999999999995 },
    UI_MOCKUP_END_POSE: { yaw: -9, pitch: 2.5, pushZ: 434.1158161626418, slideX: 0, slideY: -10.799999999999995 },
    CARD_HANDOFF_END_POSE: { yaw: -4, pitch: 1.2, pushZ: 474.85344971444135, slideX: -383.40566187013854, slideY: -10.799999999999995 },
    CARD_FOCUS_END_POSE: { yaw: 0, pitch: 0, pushZ: 1493.6170212765958, slideX: -432.24056737588666, slideY: 148.80000000000004 },
    CARD_RELEASE_END_POSE: { yaw: 0, pitch: 0, pushZ: 203.54768581086526, slideX: 0, slideY: -4.228214741439672 },
    PROMPT_INPUT_END_POSE: { yaw: 0, pitch: 0, pushZ: 278.5714285714287, slideX: 447.7999999999999, slideY: -27.107142857142946 },
    BOARD_ORBIT_END_POSE: { yaw: -34, pitch: 3.2, pushZ: -420.0000000000002, slideX: 452.65451461505273, slideY: -10.799999999999995 },
  },
};

/**
 * Le larghezze del thread per rapporto.
 *
 * PERCHE' ESISTE. In 9:16, a PromptInput ferma sul composer, la lastra si vede
 * fino a x 876 circa: un messaggio largo 1180 usciva dal quadro a meta' riga, e
 * la risposta dell'assistente, che e' la cosa che la scena mostra, si leggeva
 * tagliata. Il messaggio va a capo prima, al bordo di quello che si vede, meno
 * lo stesso margine della board. Il 16:9 vede la lastra fino a x 1954, quindi
 * restano le larghezze di sempre e i render non cambiano.
 *
 * Il bordo si calcola sulla posa finale di PromptInput, che e' frontale, e vale
 * per tutte le scene dello stesso rapporto: il thread deve essere lo stesso in
 * ogni scena, altrimenti alla giunta cambierebbe forma.
 */
export type TopicsLayout = { msgMaxW: number; toolRowMaxW: number };

export const topicsLayout = (ratio: Ratio): TopicsLayout => {
  const right = unprojectFrontal(
    STAGES[ratio],
    TOPICS_RIG,
    TOPICS_SLAB,
    { slideY: 0, ...TOPICS_POSES[ratio].PROMPT_INPUT_END_POSE },
    { x: STAGES[ratio].w, y: 0 },
  ).x;
  return {
    msgMaxW: Math.min(MSG_MAX_W, Math.floor(right - BOARD_PAD_X - MSG_TEXT_X - USER_BUBBLE_EXTRA_W)),
    toolRowMaxW: Math.min(
      TOOL_ROW_MAX_W,
      Math.floor(right - BOARD_PAD_X - (SIDEBAR_W + THREAD_PAD_X + TOOL_ROW_INDENT) - TOOL_ROW_EXTRA_W),
    ),
  };
};
