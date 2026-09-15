// CAM-06 nel rapporto: il bersaglio resta sull'origine sulle due lastre, e i due
// guasti (niente compensazione, origine incoerente) lo portano via in entrambe.
export const checks = ({ ratio }) => [
  {
    rc: 0,
    bench: "drift",
    target: `specimen-${ratio}`,
    role: "positivo",
    cmd: `./scripts/drift.py --ratio ${ratio}`,
  },
  ...['{"compensate": false}', '{"originMismatch": true}'].map((props) => ({
    rc: 0,
    bench: "drift",
    target: `specimen-${ratio}`,
    role: "negativo",
    cmd: `./scripts/drift.py --ratio ${ratio} --props '${props}' --must-fail`,
  })),
];
