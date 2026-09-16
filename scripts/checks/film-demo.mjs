// Il film di esempio (Registro) nel rapporto, in ogni formato: le regole di regia
// calcolate senza render, la tipografia sui fotogrammi, e il frame-lock.
//
// Ogni guasto delle regole ha la regola che deve accorgersene: con --regola il
// banco esce 1 solo se e' proprio quella a vederlo, quindi un guasto che fa
// scattare un'altra regola non copre la sua. I due guasti della tipografia fanno
// lo stesso con le due misure: il corpo doppio con il bordo del quadro, il fondo
// tolto con il contrasto.
const REGOLE = [
  ["camera-indietro", "camera"],
  ["sosta-corta", "dwell"],
  ["battute-sovrapposte", "cues"],
  ["esitazione-corta", "hesitation"],
  ["catena-insieme", "chain"],
  ["volo-prima-del-varco", "handoff"],
  ["stato-a-camera-ferma", "parked"],
  ["marchio-tardi", "lockup"],
];

const FRAMES = [100, 320, 560, 780, 1000, 1300];

export const checks = ({ ratio, variantName }) => {
  const film = variantName("DemoFilm");
  return [
    {
      rc: 0,
      bench: "film-rules",
      target: film,
      role: "positivo",
      cmd: `./scripts/film-rules.py --ratio ${ratio}`,
    },
    ...REGOLE.map(([guasto, regola]) => ({
      rc: 1,
      bench: "film-rules",
      target: `${film}-${guasto}`,
      role: "negativo",
      cmd: `./scripts/film-rules.py --ratio ${ratio} --guasto ${guasto} --regola ${regola}`,
    })),
    {
      rc: 0,
      bench: "film-type",
      target: film,
      role: "positivo",
      cmd: `./scripts/film-type.py --ratio ${ratio}`,
    },
    {
      rc: 1,
      bench: "film-type",
      target: `${film}-tipo-grande`,
      role: "negativo",
      cmd: `./scripts/film-type.py --ratio ${ratio} --guasto tipo-grande --regola quadro`,
    },
    {
      rc: 1,
      bench: "film-type",
      target: `${film}-senza-fondo`,
      role: "negativo",
      cmd: `./scripts/film-type.py --ratio ${ratio} --guasto senza-fondo --regola contrasto`,
    },
    // La maschera con dentro la lastra non e' una tipografia da bocciare: e' uno
    // strumento che non misura, ed esce 3.
    {
      rc: 3,
      bench: "film-type",
      target: `${film}-maschera-con-lastra`,
      role: "negativo",
      cmd: `./scripts/film-type.py --ratio ${ratio} --guasto maschera-con-lastra`,
    },
    // Il film e' frame-locked per costruzione (ogni pezzo e' una funzione del
    // fotogramma): qui lo si verifica, con un fotogramma per scena. Il negativo
    // e' lo stesso di framelocked-verdict.mjs, un fotogramma chiesto due volte:
    // le immagini distinte sono meno dei fotogrammi, come in una timeline ferma.
    // Sta anche qui perche' il job del film fa girare solo questo modulo, e la
    // copertura vuole il negativo nello stesso rapporto.
    {
      rc: 0,
      bench: "framelocked-verdict",
      target: film,
      role: "positivo",
      cmd: `FRAMES="${FRAMES.join(" ")}" ./scripts/framelocked-verdict.sh ${film}`,
    },
    {
      rc: 1,
      bench: "framelocked-verdict",
      target: `${film}-fermo`,
      role: "negativo",
      cmd: `FRAMES="${[FRAMES[0], ...FRAMES.slice(0, -1)].join(" ")}" ./scripts/framelocked-verdict.sh ${film}`,
    },
  ];
};
