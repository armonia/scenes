// Il frame-lock. Le sonde non hanno rapporto: girano una volta sola, nel 16:9,
// con la sonda che ha un Math.random dentro e deve essere bocciata. PromptInput
// si prova in ogni rapporto, nei frame in cui la battitura si vede in quel
// formato (manifest, bench framelocked-verdict).
export const checks = async ({ ratio, variantName, bench }) => {
  const g = await bench("framelocked-verdict");
  const out = [];
  if (ratio === "16x9") {
    out.push(
      {
        rc: 0,
        bench: "framelocked-verdict",
        target: "sonde-gsap",
        role: "positivo",
        cmd: "./scripts/framelocked-verdict.sh",
      },
      {
        rc: 1,
        bench: "framelocked-verdict",
        target: "FrameLockedProbeRandom",
        role: "negativo",
        cmd: "./scripts/framelocked-verdict.sh FrameLockedProbeRandom",
      },
    );
  }
  out.push(
    {
      rc: 0,
      bench: "framelocked-verdict",
      target: variantName(g.composition),
      role: "positivo",
      cmd: `FRAMES="${g.frames.join(" ")}" ./scripts/framelocked-verdict.sh ${variantName(g.composition)}`,
    },
    {
      rc: 1,
      bench: "framelocked-verdict",
      target: variantName(g.composition),
      role: "negativo",
      // Lo stesso frame due volte nell'elenco: le immagini distinte sono meno dei
      // frame chiesti, ed e' la meta' del banco che boccia una timeline ferma.
      // Nel rapporto, perche' e' li' che l'inquadratura potrebbe nasconderla.
      cmd: `FRAMES="${[g.frames[0], ...g.frames.slice(0, -1)].join(" ")}" ./scripts/framelocked-verdict.sh ${variantName(g.composition)}`,
    },
  );
  return out;
};
