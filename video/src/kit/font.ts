import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * Un carattere da file, caricato prima che il fotogramma venga catturato.
 *
 * PERCHE' ESISTE. Un film che nomina un carattere di sistema ("Helvetica Neue,
 * Arial") esce con Helvetica sul Mac e con Liberation Sans in CI: le righe hanno
 * larghezze diverse, e una frase che sul Mac sta a 36 px dal bordo in CI esce
 * dal quadro. Il carattere di un film sta in `video/public/fonts` (o nella
 * cartella public del repo che usa il kit), e il render aspetta che sia caricato.
 * Se il file manca o e' rotto il render fallisce, invece di uscire con un altro
 * carattere e sembrare giusto.
 *
 * Il caricamento vale per la pagina: piu' componenti con lo stesso carattere
 * aspettano la stessa promessa, e un componente rimontato non ricarica il file.
 */
export type FontFile = {
  /** Il nome con cui il film lo chiama in `fontFamily`. */
  family: string;
  /** Il percorso dentro public, per esempio "fonts/InterVariable.woff2". */
  file: string;
  /** Il peso, o l'intervallo per un carattere variabile ("100 900"). */
  weight?: string;
  style?: string;
};

const loading = new Map<string, Promise<void>>();

const formatOf = (file: string): string => {
  const ext = file.split(".").pop()?.toLowerCase();
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  if (ext === "ttf") return "truetype";
  throw new Error(`formato di carattere sconosciuto: ${file}`);
};

export const useFontFile = ({ family, file, weight = "100 900", style = "normal" }: FontFile): string => {
  const [handle] = useState(() => delayRender(`carattere ${family}`));
  useEffect(() => {
    const key = `${family}|${file}|${weight}|${style}`;
    let done = loading.get(key);
    if (!done) {
      const face = new FontFace(family, `url('${staticFile(file)}') format('${formatOf(file)}')`, { weight, style });
      done = face.load().then((loaded) => {
        document.fonts.add(loaded);
      });
      loading.set(key, done);
    }
    done.then(
      () => continueRender(handle),
      (err: unknown) => cancelRender(err instanceof Error ? err : new Error(`carattere ${family}: ${String(err)}`)),
    );
  }, [handle, family, file, weight, style]);
  return family;
};
