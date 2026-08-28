#!/usr/bin/env bash
#
# Da dove si chiama ImageMagick, che non ha lo stesso nome ovunque.
#
# ImageMagick 7 espone un solo eseguibile, `magick`, e gli passa il verbo:
# `magick identify`, `magick compare`. La 6, che e' ancora quella nei repo di
# Debian e Ubuntu, espone i verbi come comandi separati e NON ha `magick`.
#
# Gli script erano scritti per la 7, perche' e' quella che arriva con Homebrew.
# In CI, su ubuntu-latest, ogni chiamata usciva "magick: command not found", le
# misure leggevano stringhe vuote e stampavano 0.00 su tutti i bordi. Il deploy
# non e' partito, ma solo perche' il controllo negativo di seam.sh si e'
# accorto che due numeri identici non separano niente: senza quello, una CI
# verde avrebbe pubblicato dichiarando misure mai eseguite.
#
# Va sorgentato, non eseguito:  . "$(dirname "$0")/_magick.sh"

if command -v magick >/dev/null 2>&1; then
  IM_CONVERT=(magick)
  IM_IDENTIFY=(magick identify)
  IM_COMPARE=(magick compare)
  IM_MONTAGE=(magick montage)
elif command -v convert >/dev/null 2>&1; then
  IM_CONVERT=(convert)
  IM_IDENTIFY=(identify)
  IM_COMPARE=(compare)
  IM_MONTAGE=(montage)
else
  echo "serve ImageMagick: 'magick' (v7) oppure 'convert' (v6)." >&2
  echo "  macOS:  brew install imagemagick" >&2
  echo "  Debian: sudo apt-get install imagemagick" >&2
  exit 4
fi

# Per i sottoprocessi (python) che devono richiamare gli stessi binari.
export IM_CONVERT_CMD="${IM_CONVERT[*]}"
export IM_IDENTIFY_CMD="${IM_IDENTIFY[*]}"
