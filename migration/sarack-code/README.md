# Sarack Code / 紗絡 Code (working title)

> Development repository layout draft. The public family name is not final yet, and current generated fonts still use the internal family name `Composite Code JP Prototype V3` to avoid font-cache churn during evaluation.

A Japanese programming/terminal font prototype combining:

- **Sarasa Mono J** for Japanese/CJK glyphs and base metrics
- **Hack** for Basic Latin
- project-specific optical tuning for mixed Japanese/Latin programming use

The design target is a strict **1:2 half-width/full-width cell ratio** for VS Code, Windows Terminal, PowerShell/SSH, PuTTY, and related environments.

## Current status

Four editor-oriented styles have been validated:

- Regular
- Bold
- Italic
- Bold Italic

Current prototype tuning:

- Basic Latin U+0020..U+007E from Hack
- Sarasa Mono J Japanese/CJK retained
- strict 500/1000 half/full-width metrics in the current base
- Latin geometry enlarged optically by 3% without changing cell width
- `0` uses an approximately 120 x 120 font-unit circular center dot
- `"`, `'`, and `` ` `` receive additional optical enlargement
- `.`, `,`, `:`, and `;` receive additional enlargement; selected punctuation receives vertical optical correction
- U+3000 ideographic space is visibly marked
- Iosevka Latin variant/ligature features that could replace the Hack defaults are removed while CJK-specific features are retained

## Build model

The standalone builder does **not** require a Sarasa Gothic source-tree checkout.

It downloads pinned finished TTF inputs and post-processes them with `fontTools`:

- Sarasa Mono J 1.0.41 unhinted TTF
- Hack 3.003 TTF
- fontTools 4.63.0

This keeps the eventual public repository independent from the Sarasa Gothic fork while preserving reproducibility.

## Build

Example for Regular:

```bash
python build.py \
  --sarasa SarasaMonoJ-Regular.ttf \
  --hack Hack-Regular.ttf \
  --style Regular \
  --output out/CompositeCodeJPProtoV3-Regular.ttf
```

Supported styles:

- `Regular`
- `Bold`
- `Italic`
- `Bold Italic`

GitHub Actions is intended to fetch the pinned upstream fonts and build all four styles automatically.

## Naming

`Sarack Code / 紗絡 Code` is currently a **working title only**. The internal font family remains `Composite Code JP Prototype V3` until the final name is selected and collision checks are complete.

## Licensing and attribution

Generated fonts are derivative font software and public release packaging must preserve all applicable upstream notices and licensing conditions.

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for the precise role of:

- Sarasa Gothic / Source Han Sans
- Hack / Bitstream Vera
- HackGen / 白源 as an engineering reference

HackGen is **not** used as a font-binary input. Specific sizing/reference behavior from its MIT-licensed generator is acknowledged because it informed parts of this builder.

A release-ready license bundle will be added before the first public font release.

## Planned work

- finalize the public family name
- move this standalone layout into its own repository
- validate the four-style build from that repository
- design and test the terminal-oriented variant
- evaluate hinting for Windows small-size rendering
- decide whether to publish a Nerd Font variant
- finalize README, license bundle, screenshots, and GitHub Release packaging
