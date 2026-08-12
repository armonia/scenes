# video

The Remotion project. Scenes live in `src/scenes/`, shared primitives in
`src/primitives/`.

See the [root README](../README.md) for the four rules every scene follows, the
licensing split, and how to fetch `ref/`.

```bash
npm install
npm run dev          # Remotion studio
npm run lint         # eslint + tsc
npx remotion render <CompositionId> out/<name>.mp4
```
