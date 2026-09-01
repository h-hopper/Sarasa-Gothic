# Acknowledgements

Sarack Code combines and modifies existing open-source font work. This document records the role of each upstream project and distinguishes direct font inputs from engineering references.

## Sarasa Gothic

Japanese/CJK glyphs, metrics, and the base font tables come from **Sarasa Gothic / Sarasa Mono J** by Renzhi Li (Belleve Invis) and its upstream contributors, including Adobe's Source Han Sans work.

- Project: https://github.com/be5invis/Sarasa-Gothic
- Current pinned input: Sarasa Mono J 1.0.41, unhinted TTF
- License: SIL Open Font License 1.1
- The Sarasa license includes the Reserved Font Name `Source` for Adobe-derived portions. Sarack Code does not use `Source` as its primary font family name.

## Hack

Basic Latin U+0020..U+007E is sourced directly from **Hack v3.003** by Source Foundry Authors.

- Project: https://github.com/source-foundry/Hack
- Current pinned input: Hack 3.003
- Hack project work: MIT License
- Inherited Bitstream Vera portions retain the Bitstream Vera license and Reserved Font Names `Bitstream` and `Vera`. Sarack Code does not use those names in its font family name.

## HackGen / 白源

**HackGen / 白源** by Yuko OTAWARA is used as an **engineering reference**, not as a font-binary input.

Sarack Code directly downloads Hack and Sarasa rather than incorporating a HackGen font file. During prototype design, HackGen's published generator behavior was consulted for matters including:

- Latin/CJK sizing reference values
- selected punctuation enlargement and vertical offsets
- the general approach of tuning a dotted zero for Japanese programming-font use

The standalone Sarack Code builder was implemented independently for this project; no HackGen font binary is incorporated and no HackGen source file is copied verbatim into the current builder.

HackGen is acknowledged for provenance because its published approach and reference values materially informed design decisions. Its Reserved Font Names `白源` and `HackGen` are not used as Sarack Code family names.

- Project: https://github.com/yuru7/HackGen
- Reference revision consulted during prototype design: `6960f16d830ef1b76ccf8d99ed871a6241c28e7d`
- HackGen generator/source-code licensing: MIT License

## Project-specific changes

Sarack Code additionally applies project-specific design decisions, including:

- Sarasa Mono J retained for Japanese/CJK outlines
- Hack Basic Latin fitted into Sarasa's strict 1:2 half/full-width cells
- +3% Latin optical enlargement with unchanged advance widths
- an approximately 120 x 120 font-unit circular center dot for `0`
- selected quote and punctuation optical corrections
- a visible U+3000 ideographic-space marker
- Regular, Bold, Italic, and Bold Italic styles

The public release package will include the applicable upstream license texts and notices alongside the generated font files.
