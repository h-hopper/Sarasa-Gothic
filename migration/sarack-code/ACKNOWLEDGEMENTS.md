# Acknowledgements

This project combines and modifies existing open-source font work. The current implementation is a development prototype; final family naming and release packaging are still pending.

## Sarasa Gothic

Japanese/CJK glyphs, metrics, and the base font tables come from **Sarasa Gothic / Sarasa Mono J** by Renzhi Li (Belleve Invis) and its upstream contributors, including Adobe's Source Han Sans work.

- Project: https://github.com/be5invis/Sarasa-Gothic
- Current pinned prototype input: Sarasa Mono J 1.0.41, unhinted TTF
- License: SIL Open Font License 1.1
- The Sarasa license includes the Reserved Font Name `Source` for Adobe-derived portions. This project does not use `Source` as its primary font family name.

## Hack

Basic Latin U+0020..U+007E is sourced directly from **Hack v3.003** by Source Foundry Authors.

- Project: https://github.com/source-foundry/Hack
- Current pinned prototype input: Hack 3.003
- Hack project work: MIT License
- Inherited Bitstream Vera portions retain the Bitstream Vera license and Reserved Font Names `Bitstream` and `Vera`. This project does not use those names in its font family name.

## HackGen / 白源

**HackGen / 白源** by Yuko OTAWARA is used as an **engineering reference**, not as a font-binary input.

The builder directly downloads Hack and Sarasa rather than incorporating a HackGen font file. However, the implementation intentionally refers to HackGen's published generator behavior for items such as:

- Latin/CJK sizing reference values
- selected punctuation enlargement and vertical offsets
- the general idea of a dotted zero optimized for Japanese programming-font use

HackGen's generating scripts are MIT-licensed. Because this project carries forward specific published reference values and behavior from those scripts, the HackGen source-code attribution and MIT notice must be retained in public release documentation.

Reserved Font Names `白源` and `HackGen` are not used as this project's primary font family name.

- Project: https://github.com/yuru7/HackGen
- Reference revision used during prototype design: `6960f16d830ef1b76ccf8d99ed871a6241c28e7d`
- Generator/source-code license: MIT License, Copyright (c) 2019 Yuko OTAWARA

## Project-specific changes

The current prototype additionally applies project-specific design decisions, including:

- Sarasa Mono J retained for Japanese/CJK outlines
- Hack Basic Latin fitted into Sarasa's strict 1:2 half/full-width cells
- +3% Latin optical enlargement with unchanged advance widths
- a project-specific approximately 120 x 120 font-unit circular center dot for `0`
- selected quote and punctuation optical corrections
- a visible U+3000 ideographic-space marker
- Regular, Bold, Italic, and Bold Italic styles

The final public release will include the applicable upstream license texts alongside the generated font files.
