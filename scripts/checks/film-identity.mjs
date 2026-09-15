// Il film nel rapporto mostra gli stessi fotogrammi delle scene da sole, e una
// finestra spostata di un frame si vede.
export const checks = ({ ratio }) => [
  {
    rc: 0,
    bench: "film-identity",
    target: `film-${ratio}`,
    role: "positivo",
    cmd: `./scripts/film-identity.sh --ratio ${ratio}`,
  },
  {
    rc: 0,
    bench: "film-identity",
    target: `film-${ratio}`,
    role: "negativo",
    cmd: `./scripts/film-identity.sh --ratio ${ratio} --offset 1 --must-fail --veloce`,
  },
];
