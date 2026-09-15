// GIU-04 in un rapporto: la camera della catena non torna indietro in moto, e
// senza easing il banco se ne accorge.
export const checks = ({ ratio }) => [
  {
    rc: 0,
    bench: "chain-check",
    target: `catena-${ratio}`,
    role: "positivo",
    cmd: `./scripts/chain-check.py --ratio ${ratio}`,
  },
  {
    rc: 0,
    bench: "chain-check",
    target: `catena-${ratio}`,
    role: "negativo",
    // --must-fail rovescia il verdetto: esce 0 solo se il banco trova le
    // inversioni in moto che togliere gli easing produce.
    cmd: `./scripts/chain-check.py --ratio ${ratio} --linear --must-fail`,
  },
];
