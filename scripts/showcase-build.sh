#!/usr/bin/env bash
# Assembles the deployable showcase into showcase/dist/.
#
# The page is committed, the renders are not: out/ is gitignored because the
# files are big and rebuildable. So the deploy directory is built here, by
# copying the two renders next to the page, and it is what gets uploaded:
#
#   npx wrangler pages deploy showcase/dist --project-name remotion-scenes
#
# Run from the repo root. Exits non-zero if a render is missing, which is the
# whole point: a showcase with a broken <video> is worse than no showcase.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/video/out"
dist="$root/showcase/dist"

missing=0
for f in prompt-input.mp4 ui-mockup.mp4 card-handoff.mp4 card-focus.mp4; do
  if [ ! -f "$src/$f" ]; then
    echo "missing render: video/out/$f" >&2
    case "$f" in
      prompt-input.mp4) id=PromptInput ;;
      ui-mockup.mp4)    id=UIMockup ;;
      card-handoff.mp4) id=CardHandoff ;;
      card-focus.mp4)   id=CardFocus ;;
    esac
    echo "  cd video && npx remotion render $id out/$f" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

rm -rf "$dist"
mkdir -p "$dist"
cp "$root/showcase/index.html" "$dist/index.html"
# La seconda pagina: il catalogo dei movimenti. Sta qui e non in un artifact
# perche' cosi' vive dove vive il resto, si versiona con le scene che descrive
# e si apre in locale identica a come esce online.
cp "$root/showcase/grammatica.html" "$dist/grammatica.html"
cp "$src/prompt-input.mp4" "$src/ui-mockup.mp4" "$src/card-handoff.mp4" \
   "$src/card-focus.mp4" "$dist/"

echo "showcase/dist ready:"
du -h "$dist"/* | sed 's|'"$root"'/||'
