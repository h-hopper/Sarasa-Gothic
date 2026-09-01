# Composite Code JP Prototype

> `Composite Code JP Prototype` is an evaluation-only internal family name. It is **not** the final font name.

## Goal

Build a Japanese programming font with:

- Japanese/CJK appearance from **Sarasa Mono J 1.0.41**
- Basic Latin appearance from **Hack 3.003**
- HackGen-derived sizing/legibility logic where it materially improves coding use
- strict half-width : full-width cell ratio of **1:2**

The current milestone is deliberately limited to **Regular**.

## Prototype strategy

The prototype post-processes the official **Sarasa Mono J 1.0.41 unhinted Regular** TTF rather than rebuilding the complete Sarasa family.

This keeps the Japanese/CJK side unchanged while making the Latin experiment small and reversible.

For every Basic Latin glyph U+0020..U+007E:

1. Rebase the Hack donor font to the Sarasa UPM.
2. Apply HackGen-reference geometry:
   - HackGen reference UPM: 1024
   - HackGen reference half-width: 540
   - horizontal scale: 88%
   - vertical scale: 97%
3. Convert the horizontal scale to Sarasa's detected half-width cell.
4. Center the transformed Hack glyph in the Sarasa half-width cell.
5. Apply the accepted visual adjustment:
   - enlarge Basic Latin outlines by **3%**
   - scale around the half-width cell center horizontally and 0.35 em vertically
   - keep the advance width unchanged
6. For U+0030, reshape only the internal dot to approximately **120 × 120 font units** and place it at the geometric center of the zero outline/cell.
7. Keep Sarasa's vertical metrics.
8. Force the advance width to Sarasa's half-width cell.

The builder refuses to continue unless the Sarasa source already satisfies full-width = 2 × half-width.
After serialization it re-opens the generated font and validates the ratio again.
It also validates the size and center position of the U+0030 dot.

## V3 legibility corrections

The Windows/VS Code review of v2 showed that the overall Latin/CJK balance was already good, so v3 keeps the general geometry unchanged and only adds targeted corrections where HackGen's precedent is useful.

### ASCII punctuation

After the general +3% Latin tuning:

- U+0022 `"`, U+0027 `'`, U+0060 `` ` ``: additional **10%** enlargement.
- U+002E `.`, U+002C `,`, U+003A `:`, U+003B `;`: additional **8%** enlargement.
- HackGen-reference vertical offsets are retained for:
  - semicolon: +18 units at HackGen UPM 1024, scaled to the current UPM
  - period: +5 units at HackGen UPM 1024, scaled to the current UPM
  - comma: -8 units at HackGen UPM 1024, scaled to the current UPM

These corrections do not change advance widths.

### Visible ideographic space

U+3000 IDEOGRAPHIC SPACE is intentionally visible.

HackGen uses a dotted rounded rectangle for this purpose. V3 follows that concept but uses a restrained marker:

- dotted rounded-rectangle shape
- dots approximately **60 font units** across at UPM 1000
- centered in the full-width cell
- advance width remains the normal full-width cell

This is a font glyph, not an editor overlay. Therefore the marker can also appear in printed/PDF output when this font is used. For the intended VS Code/terminal use that trade-off is accepted.

No other Japanese glyphs are modified in v3. In particular, dakuten/handakuten, `ー`/`一`, and hiragana/katakana `へ`/`ヘ` stay exactly as Sarasa provides them unless actual legibility problems are observed later.

## Dotted zero rationale

The first dotted-zero experiment used an excessively small round dot and could become faint at 12–16 px.
The accepted target of about 120 × 120 units remains visible at normal editor sizes while avoiding the large vertical capsule seen in the initial Hack-derived zero.

Small-size rasterization can make a geometrically centered dot look slightly off-center. The builder therefore keeps the dot at the true geometric center rather than adding an optical left/right offset that would become visible at larger sizes.

## OpenType features

Iosevka character-variant and Latin ligature features are disabled in the prototype so that enabling an old Sarasa/Iosevka feature cannot replace the new default Hack glyphs with Iosevka alternates.
The optional OpenType `zero` feature is also disabled because the desired dotted zero is baked into the default U+0030 glyph.

CJK-specific features such as `locl` and `vert` are left intact.

## Build

GitHub Actions workflow:

- `.github/workflows/build-composite-prototype.yml`

Builder:

- `tools/composite-prototype/build.mjs`

The workflow downloads pinned inputs:

- Sarasa Mono J 1.0.41, unhinted Regular
- Hack 3.003 Regular

and uploads an artifact containing:

- `CompositeCodeJPProtoV3-Regular.ttf`
- Sarasa license
- Hack license
- provenance notes

## Evaluation sequence

Check the generated Regular font in this order:

1. VS Code editor
2. Windows Terminal
3. PuTTY
4. VS Code integrated terminal

Suggested text:

```text
0 O o Q    1 I l |
00000000 O0O0O0O0
"double" 'single' `backtick`
.... ,,,, :::: ;;;;
ASCII-space:[ ]
fullwidth-space:[　]
A　B　C
Config設定123 = "日本語テスト";
日本語　ABC　123　設定
```

Evaluate:

- dotted zero visibility at 12–18 px
- dotted zero centering at both small and large sizes
- `0/O`, `1/I/l/|` distinction
- Latin visual size relative to Japanese
- quote and punctuation visibility
- U+3000 marker visibility without excessive visual weight
- baseline
- 1:2 alignment in terminal applications

## Next steps after Regular approval

1. Validate the v3 Regular on Windows rendering (VS Code, Windows Terminal, PuTTY).
2. Add Bold with equivalent optical tuning, adjusted only if Bold needs a different value.
3. Decide the final family name.
4. Add a terminal-oriented variant if needed.
5. Add hinting after the core glyph geometry is stable.
6. Add Nerd Font symbols only after the base font is stable.

## Naming

`Polaris Code JP` was considered as a working name but is not recommended as the final public name because multiple existing typefaces already use **Polaris**.

The generated v3 font uses `Composite Code JP Prototype V3` as an evaluation-only internal family name so it can coexist with prior prototypes without a Windows font-cache collision.
The final name should be chosen only after the Regular prototype is visually accepted.
