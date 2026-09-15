// CAM-01 in geometria in un rapporto: la lastra copre il quadro, e con la
// camera arretrata non lo copre piu' in nessuna scena.
export const checks = ({ ratio }) => [
  {
    rc: 0,
    bench: "fill-geom",
    target: `catena-${ratio}`,
    role: "positivo",
    cmd: `./scripts/fill-geom.py --ratio ${ratio}`,
  },
  {
    rc: 0,
    bench: "fill-geom",
    target: `catena-${ratio}`,
    role: "negativo",
    cmd: `./scripts/fill-geom.py --ratio ${ratio} --push-offset -1500 --must-fail`,
  },
];
