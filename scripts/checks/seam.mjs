// Le giunte del rapporto: ogni coppia che il catalogo aggancia (seamAfter) e'
// continua, e una coppia al contrario, dove la giunta non esiste, esce 1.
export const checks = ({ ratio, scenes, scene }) => {
  const pairs = scenes
    .filter((s) => s.seamAfter)
    .map((s) => [scene(s.seamAfter), s]);
  if (pairs.length === 0) return [];
  const [a, b] = pairs[0];
  return [
    ...pairs.map(([p, s]) => ({
      rc: 0,
      bench: "seam",
      target: `${p.variant}>${s.variant}`,
      role: "positivo",
      cmd: `./scripts/seam.sh ${p.file} ${s.file}`,
    })),
    {
      rc: 1,
      bench: "seam",
      target: `${b.variant}>${a.variant}`,
      role: "negativo",
      // La stessa coppia al contrario: l'ultimo fotogramma di B non e' il primo
      // di A, e il banco deve dirlo come salto, non come misura inutile.
      cmd: `./scripts/seam.sh ${b.file} ${a.file}`,
    },
  ];
};
