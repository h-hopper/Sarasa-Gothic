# Sarack Code / 紗絡

**Sarack Code** is a Japanese programming and terminal font built from **Sarasa Mono J** and **Hack**, with project-specific optical tuning for mixed Japanese/Latin source code.

The Japanese brand name **紗絡** is a coined name expressing the idea of weaving and combining different typefaces. `Sarack` is also inspired by the project's two primary typeface sources: Sarasa Gothic and Hack.

The design target is a strict **1:2 half-width/full-width cell ratio** for VS Code, Windows Terminal, PowerShell/SSH, PuTTY, and related environments.

> Sarack Code is still under development. The four editor-oriented styles are visually validated, but the terminal-oriented variant, hinting policy, release packaging, and first stable version are not final yet.

## Current status

Four editor-oriented styles have been validated:

- Regular
- Bold
- Italic
- Bold Italic

Current tuning includes:

- Basic Latin U+0020..U+007E from Hack
- Sarasa Mono J Japanese/CJK retained
- strict 500/1000 half/full-width metrics in the current base
- Latin geometry enlarged optically by 3% without changing cell width
- `0` with an approximately 120 x 120 font-unit circular center dot
- additional optical enlargement for `"`, `'`, and `` ` ``
- additional enlargement for `.`, `,`, `:`, and `;`, with selected vertical optical corrections
- a visible U+3000 ideographic-space marker
- removal of Iosevka Latin variant/ligature features that could replace Hack defaults while retaining CJK-specific features

## Font sources

Sarack Code currently uses pinned finished TTF inputs:

- **Sarasa Mono J 1.0.41**, unhinted TTF — Japanese/CJK outlines, base metrics, and base OpenType tables
- **Hack 3.003** — Basic Latin outlines

The standalone builder does **not** require a Sarasa Gothic source-tree checkout. It post-processes the pinned TTF inputs with `fontTools`, keeping the eventual public repository independent from the Sarasa Gothic fork.

## Build

Example for Regular:

```bash
python build.py \
  --sarasa SarasaMonoJ-Regular.ttf \
  --hack Hack-Regular.ttf \
  --style Regular \
  --family "Sarack Code" \
  --output out/SarackCode-Regular.ttf
```

Supported styles:

- `Regular`
- `Bold`
- `Italic`
- `Bold Italic`

GitHub Actions fetches the pinned upstream fonts and builds all four styles automatically.

## Licensing

The intended public-release licensing layout is deliberately split by component:

- **generated Sarack Code font files:** SIL Open Font License 1.1
- **project-authored build tooling:** MIT License
- **third-party notices:** retained separately for Sarasa Gothic / Source Han Sans and Hack / Bitstream Vera

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for provenance and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the release-notice structure.

### HackGen / 白源 reference

HackGen is **not** used as a font-binary input. Its published generator behavior was consulted as an engineering reference for Latin/CJK sizing and selected punctuation adjustments. Sarack Code downloads Hack and Sarasa directly.

No HackGen font binary is incorporated, and the standalone builder was independently implemented for this project. HackGen is nevertheless acknowledged because its published approach and reference values materially informed prototype design decisions.

## AI-assisted development

Sarack Code was developed with substantial assistance from **ChatGPT by OpenAI**, including research, implementation of build tooling, automated validation, and development workflow support. Font-design decisions and rendered-output evaluation were directed and reviewed by the project maintainer.

AI assistance is a development-process disclosure; it does not replace or alter the licenses and attribution requirements of the upstream font projects.

## Planned work

- move this standalone layout into a dedicated public repository
- validate the four-style build from that repository
- design and test `Sarack Code Term`
- evaluate hinting for Windows small-size rendering
- decide whether to publish a Nerd Font variant
- finalize release screenshots and GitHub Release packaging
- perform final metadata and license-package validation before the first public font release
