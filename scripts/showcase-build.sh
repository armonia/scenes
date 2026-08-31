#!/usr/bin/env bash
# Assembla la vetrina pubblicabile in showcase/dist/.
#
# La pagina e' un template (showcase/index.template.html) con un segnaposto
# <!-- SCENES -->: la sezione delle scene viene generata qui a partire da
# video/src/scenes/catalog.json, lo stesso file da cui Root.tsx dichiara le
# composition e da cui il workflow ricava render e banchi. Prima ogni scena
# nuova andava scritta a mano anche nella pagina, e una scena renderizzata ma
# non aggiunta all'HTML restava invisibile senza che niente diventasse rosso.
#
# I RENDER NON SONO IN GIT: out/ e' gitignorato perche' sono file grossi e
# rigenerabili. Quindi la directory di deploy si costruisce qui, copiando i
# render accanto alla pagina, ed e' quella che viene caricata:
#
#   npx wrangler pages deploy showcase/dist --project-name remotion-scenes
#
# Si lancia dalla radice del repo. Esce non-zero se manca un render, che e' il
# punto: una vetrina con un <video> rotto e' peggio di nessuna vetrina.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/video/out"
dist="$root/showcase/dist"

missing=0
while read -r slug; do
  [ -f "$src/$slug.mp4" ] && continue
  echo "missing render: video/out/$slug.mp4" >&2
  echo "  cd video && $(node "$root/scripts/catalog.mjs" render | grep -- "$slug.mp4")" >&2
  missing=1
done < <(node "$root/scripts/catalog.mjs" slugs)
[ "$missing" -eq 0 ] || exit 1

rm -rf "$dist"
mkdir -p "$dist"

# La pagina, con la sezione delle scene innestata nel segnaposto.
node "$root/scripts/catalog.mjs" page \
  "$root/showcase/index.template.html" "$dist/index.html"

# La seconda pagina: il catalogo dei movimenti. Sta qui e non in un artifact
# perche' cosi' vive dove vive il resto, si versiona con le scene che descrive
# e si apre in locale identica a come esce online.
cp "$root/showcase/grammatica.html" "$dist/grammatica.html"

while read -r slug; do
  cp "$src/$slug.mp4" "$dist/"
done < <(node "$root/scripts/catalog.mjs" slugs)

echo "showcase/dist ready:"
du -h "$dist"/* | sed 's|'"$root"'/||'
