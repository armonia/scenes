// Il tempo nel rapporto: il provino a meta' durata di CardHandoff e' la stessa
// scena piu' veloce, e la stessa scena troncata non lo e'. Le finestre in cui le
// soglie percettive non scalano le dichiara la scena (manifest, bench tempo). I provini li rende
// la CI prima dei controlli (fixture-tempo.sh --ratio), come le scene.
export const checks = async ({ ratio, scene, fixtures, tmp, bench }) => {
  const g = await bench("tempo");
  const win = `--percettive ${g.perceptual.map(([a, b]) => `${a}-${b}`).join(",")}`;
  const long = scene(g.scene).file;
  const fast = fixtures.find((f) => f.scene === g.scene);
  if (!fast) throw new Error("catalog.json: nessun provino del tempo per CardHandoff");
  const trim = `${tmp("fixture-trim")}.mp4`;
  return [
    {
      rc: 0,
      bench: "tempo",
      target: `CardHandoff-${ratio}`,
      role: "positivo",
      cmd: `./scripts/tempo.py ${long} ${fast.file} ${win}`,
    },
    { run: `./scripts/fixture-trim.sh ${long} ${fast.file} ${trim}`, label: `ritaglio non ritempificato ${ratio}` },
    {
      rc: 1,
      bench: "tempo",
      target: `CardHandoff-${ratio}`,
      role: "negativo",
      cmd: `./scripts/tempo.py ${long} ${trim} ${win}`,
    },
  ];
};
