import { Easing, interpolate } from "remotion";

/**
 * Il percorso di una mano come dato: waypoint col frame in cui vanno raggiunti.
 *
 * Stava dentro Cursor.tsx. E' qui, in un modulo puro, perche' lo leggono anche i
 * banchi da Node: handoff-travel deve sapere dove sta la card che la mano
 * trascina senza renderizzare, e un .tsx da Node non si importa.
 */

export type Waypoint = { x: number; y: number; at: number };

/**
 * Dove sta il puntatore a un dato frame.
 *
 * ESPORTATA perche' una scena in cui il puntatore TRASCINA qualcosa ha bisogno
 * della sua posizione, non solo del suo disegno: la card che segue la mano sta
 * dove stava la mano tre frame prima, e l'inclinazione esce dalla differenza
 * fra due campioni. Tenuto dentro il componente, quel numero non era
 * raggiungibile e la scena avrebbe dovuto ricalcolarsi il percorso per conto
 * suo - due copie della stessa traiettoria, uguali finche' nessuno tocca una
 * delle due.
 */
export const pointOnPath = (
  path: Waypoint[],
  frame: number,
): { x: number; y: number } => {
  const first = path[0] as Waypoint;
  const last = path[path.length - 1] as Waypoint;
  if (frame <= first.at) return { x: first.x, y: first.y };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i] as Waypoint;
    const b = path[i + 1] as Waypoint;
    if (frame >= a.at && frame <= b.at) {
      const ease = {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp" as const,
        extrapolateRight: "clamp" as const,
      };
      return {
        x: interpolate(frame, [a.at, b.at], [a.x, b.x], ease),
        y: interpolate(frame, [a.at, b.at], [a.y, b.y], ease),
      };
    }
  }
  return { x: last.x, y: last.y };
};
