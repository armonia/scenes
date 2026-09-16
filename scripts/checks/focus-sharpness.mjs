// CAM-04 nel rapporto: il testo regge l'ingrandimento sul render vero; la stessa
// discesa fatta di uno screenshot ingrandito esce 1; il render di questo rapporto
// misurato con la geometria di un altro esce 3 invece di dare un numero.
export const checks = ({ ratio, scene, tmp }) => {
  const src = scene("CardFocus");
  const fixture = `${tmp("fixture-screenshot")}.mp4`;
  const other = ratio === "16x9" ? "9x16" : "16x9";
  return [
    {
      rc: 0,
      bench: "focus-sharpness",
      target: src.variant,
      role: "positivo",
      cmd: `./scripts/focus-sharpness.sh ${src.file} --ratio ${ratio}`,
    },
    { run: `./scripts/fixture-screenshot.sh ${src.file} ${fixture} --ratio ${ratio}`, label: `screenshot ingrandito ${ratio}` },
    {
      rc: 1,
      bench: "focus-sharpness",
      target: `${src.variant}-screenshot`,
      role: "negativo",
      cmd: `./scripts/focus-sharpness.sh ${fixture} --ratio ${ratio}`,
    },
    {
      rc: 3,
      bench: "focus-sharpness",
      target: `${src.variant}-geometria-${other}`,
      role: "negativo",
      cmd: `./scripts/focus-sharpness.sh ${src.file} --ratio ${other}`,
    },
  ];
};
