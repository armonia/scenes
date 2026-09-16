// CAM-05 nel rapporto: il contenuto attenuato regge 3:1 sulla scena e sul suo
// provino veloce; la stessa scena attenuata a 0,25 esce 1; un ritaglio sul fondo
// esce 3 invece di dare la colpa al pavimento.
export const checks = async ({ ratio, stage, scene, fixtures, variantName, tmp, bench }) => {
  const g = await bench("contrast-floor");
  const out = [];
  for (const v of g.variants) {
    const file = v.id === "PromptInput" ? scene("PromptInput").file : fixtures.find((f) => f.id === v.id).file;
    out.push({
      rc: 0,
      bench: "contrast-floor",
      target: variantName(v.id),
      role: "positivo",
      cmd: `./scripts/contrast-floor.py ${file} --ratio ${ratio} --scene ${v.id}`,
    });
  }
  const main = g.variants.find((v) => v.id === "PromptInput");
  const png = `${tmp("attn-025")}.png`;
  const blank = `${tmp("fondo")}.png`;
  out.push(
    { run: `./scripts/fixture-attenuation.sh ${variantName("PromptInput")} ${main.frame} ${png}`, label: `attenuazione a 0,25 ${ratio}` },
    {
      rc: 1,
      bench: "contrast-floor",
      target: `${variantName("PromptInput")}-attn025`,
      role: "negativo",
      cmd: `./scripts/contrast-floor.py ${png} --ratio ${ratio} --scene PromptInput`,
    },
    {
      run: `ffmpeg -nostdin -v error -f lavfi -i color=c=0x16171a:s=${stage.w}x${stage.h} -frames:v 1 -y ${blank}`,
      label: `fondo uniforme ${ratio}`,
    },
    {
      rc: 3,
      bench: "contrast-floor",
      target: `fondo-${ratio}`,
      role: "negativo",
      cmd: `./scripts/contrast-floor.py ${blank} --ratio ${ratio} --scene PromptInput`,
    },
  );
  return out;
};
