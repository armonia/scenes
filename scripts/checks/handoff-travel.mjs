// CHR-01 nel rapporto: la card attraversa sulla lastra, sulla scena e sul
// provino veloce. Un fermo immagine, la scena al contrario e un taglio secco
// prima del trascinamento escono 1: la camera del render non e' piu' quella del
// manifest, e le intestazioni delle colonne si muovono sulla lastra raddrizzata.
export const checks = ({ ratio, scene, fixtures, variantName, tmp }) => {
  const s = scene("CardHandoff");
  const fast = fixtures.find((f) => f.scene === "CardHandoff");
  const n = s.durationInFrames;
  const png = `${tmp("travel-f0")}.png`;
  const freeze = `${tmp("travel-fermo")}.mp4`;
  const reverse = `${tmp("travel-contrario")}.mp4`;
  const cut = `${tmp("travel-taglio")}.mp4`;
  // Il taglio cade dove la mano afferra la card, a un terzo della scena: da li'
  // in poi il fotogramma resta fermo.
  const cutAt = Math.round(n * 0.35);
  const neg = (target, file) => ({
    rc: 1,
    bench: "handoff-travel",
    target: `${s.variant}-${target}`,
    role: "negativo",
    cmd: `./scripts/handoff-travel.py ${file} --ratio ${ratio}`,
  });
  return [
    {
      rc: 0,
      bench: "handoff-travel",
      target: s.variant,
      role: "positivo",
      cmd: `./scripts/handoff-travel.py ${s.file} --ratio ${ratio}`,
    },
    {
      rc: 0,
      bench: "handoff-travel",
      target: variantName(fast.id),
      role: "positivo",
      cmd: `./scripts/handoff-travel.py ${fast.file} --ratio ${ratio} --scene ${fast.id}`,
    },
    {
      run: `ffmpeg -nostdin -v error -i ${s.file} -frames:v 1 -y ${png} && ffmpeg -nostdin -v error -loop 1 -i ${png} -frames:v ${n} -r ${s.fps} -pix_fmt yuv420p -y ${freeze}`,
      label: `handoff fermo immagine ${ratio}`,
    },
    neg("fermo", freeze),
    { run: `ffmpeg -nostdin -v error -i ${s.file} -vf reverse -fps_mode passthrough -y ${reverse}`, label: `handoff al contrario ${ratio}` },
    neg("contrario", reverse),
    {
      run: `ffmpeg -nostdin -v error -i ${s.file} -vf "trim=end_frame=${cutAt},tpad=stop_mode=clone:stop=${n - cutAt}" -fps_mode passthrough -y ${cut}`,
      label: `handoff taglio secco ${ratio}`,
    },
    neg("taglio", cut),
  ];
};
