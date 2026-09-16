// I bordi fermi nel rapporto: le scene che lo dichiarano (restAtEdges) lo sono;
// un ritaglio dal mezzo di una scena si muove ai bordi (1); un fermo immagine
// non si muove da nessuna parte e lascia il banco senza controllo (2).
export const checks = ({ ratio, scene, tmp }) => {
  const src = scene("CardFocus");
  const secs = src.durationInFrames / src.fps;
  const mosso = `${tmp("rest-mosso")}.mp4`;
  const png = `${tmp("rest-fermo")}.png`;
  const fermo = `${tmp("rest-fermo")}.mp4`;
  return [
    {
      rc: 0,
      bench: "rest-point",
      target: `restAtEdges-${ratio}`,
      role: "positivo",
      cmd: `./scripts/rest-point.sh --ratio ${ratio}`,
    },
    {
      run: `ffmpeg -nostdin -v error -ss ${(secs * 0.35).toFixed(3)} -t ${(secs * 0.35).toFixed(3)} -i ${src.file} -y ${mosso}`,
      label: `ritaglio mosso da ${src.variant}`,
    },
    {
      rc: 1,
      bench: "rest-point",
      target: `${src.variant}-mosso`,
      role: "negativo",
      cmd: `./scripts/rest-point.sh ${mosso}`,
    },
    {
      run: `ffmpeg -nostdin -v error -i ${src.file} -frames:v 1 -y ${png} && ffmpeg -nostdin -v error -loop 1 -i ${png} -t 3 -r 30 -pix_fmt yuv420p -y ${fermo}`,
      label: `fermo immagine da ${src.variant}`,
    },
    {
      rc: 2,
      bench: "rest-point",
      target: `${src.variant}-fermo`,
      role: "negativo",
      cmd: `./scripts/rest-point.sh ${fermo}`,
    },
  ];
};
