/**
 * Il tempo di una scena, e la distinzione senza la quale non si puo' cambiare.
 *
 * PERCHE' ESISTE. I video di motion design sono densi: le reference che questo
 * repo inseguue stanno fra i 13 e i 42 secondi e dentro ci mettono piu' roba di
 * quanta ce ne sia in questi 48. Finora andare piu' veloce voleva dire aprire
 * ogni scena e riscrivere a mano una decina di costanti - GRAB 78, DRAG_END
 * 176, CAM_SETTLE 132 - tenendole coerenti fra loro a occhio. E' il genere di
 * lavoro che si sbaglia in silenzio: basta dimenticarne una e il gesto si
 * scompone senza che nessun banco lo dica.
 *
 * ADESSO IL TEMPO E' LA DURATA. Ogni scena dichiara i suoi tempi rispetto a una
 * durata di riferimento; `durationInFrames` in catalog.json li scala tutti.
 * Dimezzare la durata dimezza ogni battuta al suo interno, non taglia la coda.
 * Cambiare la velocita' di una clip e' cambiare un numero in un file JSON.
 *
 * MA NON TUTTO SI SCALA, e questa e' la parte che conta. Ci sono due specie di
 * numeri nelle scene:
 *
 *   I TEMPI DEL MONTAGGIO scalano. Quando la mano arriva, quanto dura la corsa,
 *   quando la camera si posa: sono decisioni di ritmo, e il ritmo e' proprio
 *   quello che si vuole cambiare.
 *
 *   LE SOGLIE PERCETTIVE no. I quattro frame fra il clic e la sua conseguenza
 *   non sono ritmo, sono la finestra in cui l'occhio lega un gesto al suo
 *   effetto: `click-gap.sh` misura che stiano fra 1 e 8, e a velocita' doppia
 *   diventerebbero due, cioe' sul bordo di sparire. I tre frame di ritardo
 *   della card sulla mano sono il peso dell'oggetto, non la fretta del
 *   montaggio. Il lampeggio del caret e' una frequenza, non una durata.
 *
 * Scalare le seconde insieme alle prime e' il modo in cui una scena piu' veloce
 * diventa una scena rotta. Qui `at()` scala e i numeri nudi non scalano, e ogni
 * numero nudo dentro una scena ha accanto il motivo per cui e' rimasto nudo.
 */

export type Tempo = {
  /** Il fattore: durata effettiva su durata di riferimento. */
  k: number;
  /** Un tempo del montaggio, in frame alla durata di riferimento. */
  at: (frames: number) => number;
};

export const tempo = (durationInFrames: number, base: number): Tempo => {
  if (base <= 0) throw new Error("tempo(): la durata di riferimento deve essere positiva");
  const k = durationInFrames / base;
  return { k, at: (frames: number) => frames * k };
};
