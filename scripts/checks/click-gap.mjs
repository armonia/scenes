// CUR-03 nel rapporto: il clic d'invio e la bolla stanno a qualche frame di
// distanza sulla scena e sul suo provino veloce. Tre copie guaste della scena,
// tutte della stessa durata, escono 1: eventi fusi (tolti i frame fra clic e
// bolla), interfaccia lenta (sei frame fermi dopo il clic, scarto 11), clic
// mancato (il fotogramma prima del clic tenuto fino alla fine). I frame per
// costruirle vengono dal manifest; il banco non li riceve.
export const checks = async ({ ratio, scene, fixtures, variantName, tmp, bench }) => {
  const g = await bench("click-gap");
  const out = [];
  for (const v of g.variants) {
    const file = v.id === "PromptInput" ? scene("PromptInput").file : fixtures.find((f) => f.id === v.id).file;
    out.push({
      rc: 0,
      bench: "click-gap",
      target: variantName(v.id),
      role: "positivo",
      cmd: `./scripts/click-gap.py ${file} --ratio ${ratio} --scene ${v.id}`,
    });
  }
  const main = g.variants.find((v) => v.id === "PromptInput");
  const src = scene("PromptInput").file;
  const n = main.durationInFrames;
  const click = Math.ceil(main.events.sendClick);
  const bubble = Math.ceil(main.events.bubbleAt) + 1;
  const guaste = [
    {
      name: "fusi",
      vf: `select='lt(n\\,${click})+gte(n\\,${bubble})',setpts=N/FRAME_RATE/TB,tpad=stop_mode=clone:stop=${bubble - click}`,
    },
    { name: "lenta", vf: `loop=loop=6:size=1:start=${click + 2},setpts=N/FRAME_RATE/TB,trim=end_frame=${n}` },
    { name: "mancato", vf: `trim=end_frame=${click},tpad=stop_mode=clone:stop=${n - click}` },
  ];
  for (const x of guaste) {
    const f = `${tmp(`click-${x.name}`)}.mp4`;
    out.push(
      {
        run: `ffmpeg -nostdin -v error -i ${src} -vf "${x.vf}" -fps_mode passthrough -y ${f}`,
        label: `click-gap ${x.name} ${ratio}`,
      },
      {
        rc: 1,
        bench: "click-gap",
        target: `${variantName("PromptInput")}-${x.name}`,
        role: "negativo",
        cmd: `./scripts/click-gap.py ${f} --ratio ${ratio}`,
      },
    );
  }
  return out;
};
