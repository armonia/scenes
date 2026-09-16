// I quattro tempi di PromptInput nel rapporto, sulla scena e sul provino veloce.
// Senza OCR il banco esce 3; un fermo immagine della fine e la coda del thread
// coperta (la regressione del composer sopra i messaggi) escono 1.
export const checks = async ({ ratio, scene, fixtures, variantName, tmp, bench }) => {
  const g = await bench("beats");
  const out = [];
  for (const v of g.variants) {
    const file = v.id === "PromptInput" ? scene("PromptInput").file : fixtures.find((f) => f.id === v.id).file;
    out.push({
      rc: 0,
      bench: "beats",
      target: variantName(v.id),
      role: "positivo",
      cmd: `./scripts/beats.py ${file} --ratio ${ratio} --scene ${v.id}`,
    });
  }
  const main = g.variants.find((v) => v.id === "PromptInput");
  const src = scene("PromptInput").file;
  const png = `${tmp("beats-fine")}.png`;
  const fermo = `${tmp("beats-fermo")}.mp4`;
  const coperto = `${tmp("beats-coperto")}.mp4`;
  const c = main.cover;
  out.push(
    {
      rc: 3,
      bench: "beats",
      target: `${variantName("PromptInput")}-senza-ocr`,
      role: "negativo",
      cmd: `TESSERACT=/nonexistent/tesseract ./scripts/beats.py ${src} --ratio ${ratio}`,
    },
    {
      run: `ffmpeg -nostdin -v error -sseof -0.1 -i ${src} -frames:v 1 -update 1 -y ${png} && ffmpeg -nostdin -v error -loop 1 -i ${png} -frames:v ${main.durationInFrames} -r ${g.fps} -pix_fmt yuv420p -y ${fermo}`,
      label: `beats fermo immagine ${ratio}`,
    },
    {
      rc: 1,
      bench: "beats",
      target: `${variantName("PromptInput")}-fermo`,
      role: "negativo",
      cmd: `./scripts/beats.py ${fermo} --ratio ${ratio}`,
    },
    {
      run: `ffmpeg -nostdin -v error -i ${src} -vf "drawbox=x=${c.x}:y=${c.y}:w=${c.w}:h=${c.h}:color=0x111214:t=fill" -fps_mode passthrough -y ${coperto}`,
      label: `beats coda coperta ${ratio}`,
    },
    {
      rc: 1,
      bench: "beats",
      target: `${variantName("PromptInput")}-coperto`,
      role: "negativo",
      cmd: `./scripts/beats.py ${coperto} --ratio ${ratio}`,
    },
  );
  return out;
};
