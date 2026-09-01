# Third-party notices

Sarack Code is built from open-source font software. The generated font files are intended to be distributed under the SIL Open Font License 1.1, while preserving all applicable upstream copyright and license notices.

This file is a provenance and packaging guide. Before the first public binary release, the dedicated Sarack Code repository and release archive must include verbatim copies of the applicable upstream license texts.

## Sarasa Gothic / Sarasa Mono J

Sarack Code uses finished **Sarasa Mono J** TTF files as its Japanese/CJK base.

Copyright (c) 2015-2025, Renzhi Li (aka. Belleve Invis).
Portions Copyright (c) 2016 The Inter Project Authors.
Portions Copyright (c) 2014-2021 Adobe Systems Incorporated, with Reserved Font Name `Source`.
Portions Copyright (c) 2012 Google Inc.

License: SIL Open Font License 1.1.

Upstream project: https://github.com/be5invis/Sarasa-Gothic

Release packaging requirement: include the Sarasa Gothic OFL license/copyright notice verbatim. Sarack Code must not use an applicable Reserved Font Name as its primary font name without permission.

## Hack / Bitstream Vera

Sarack Code sources Basic Latin U+0020..U+007E directly from **Hack v3.003**.

Hack project work:

Copyright 2018 Source Foundry Authors.
License: MIT License.

Inherited Bitstream Vera portions:

Copyright 2003 Bitstream, Inc. All Rights Reserved.
Reserved Font Names: `Bitstream`, `Vera`.
License: Bitstream Vera License.

Upstream project: https://github.com/source-foundry/Hack

Release packaging requirement: include Hack's complete upstream `LICENSE.md`, including the MIT and Bitstream Vera notices, alongside distributed Sarack Code binaries. Sarack Code does not use `Bitstream` or `Vera` in its family name.

## HackGen / 白源

**HackGen / 白源** is not a font-binary dependency of Sarack Code.

The project was consulted as an engineering reference during prototype design, including published sizing values and selected punctuation-tuning behavior. The standalone Sarack Code builder was independently implemented and does not incorporate a HackGen font binary or copy a HackGen source file verbatim.

Project: https://github.com/yuru7/HackGen
Reference revision consulted: `6960f16d830ef1b76ccf8d99ed871a6241c28e7d`

HackGen's generating scripts are MIT-licensed, Copyright (c) 2019 Yuko OTAWARA. Its font Reserved Font Names include `白源` and `HackGen`.

Because HackGen is an engineering/provenance reference rather than a distributed font input, its font OFL is not treated as a binary dependency of Sarack Code. The project remains explicitly credited in `ACKNOWLEDGEMENTS.md`.

## Release checklist

Before publishing a GitHub Release containing TTF files, verify that the archive contains at least:

- `LICENSE-FONT` — SIL Open Font License 1.1 for Sarack Code font software
- `LICENSE-CODE` — MIT License for project-authored build tooling when source is distributed with the package
- a verbatim Sarasa Gothic license/copyright file
- a verbatim Hack `LICENSE.md`, including Bitstream Vera terms
- `THIRD_PARTY_NOTICES.md`
- `ACKNOWLEDGEMENTS.md`

Also verify the font `name` table copyright/license metadata and Reserved Font Name constraints before the first stable release.
