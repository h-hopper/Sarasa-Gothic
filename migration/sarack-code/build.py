#!/usr/bin/env python3
"""Standalone prototype builder for the future dedicated repository.

This intentionally depends only on fontTools and finished upstream TTF files.
It does not import Sarasa Gothic's internal build helpers.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

PROTOTYPE_FAMILY = "Composite Code JP Prototype V3"
PROTOTYPE_VERSION = "0.0.3-prototype"

HACKGEN_REFERENCE_EM = 1024
HACKGEN_REFERENCE_HALF_WIDTH = 540
HACKGEN_REFERENCE_SCALE_X = 0.88
HACKGEN_REFERENCE_SCALE_Y = 0.97

LATIN_VISUAL_SCALE = 1.03
LATIN_VISUAL_CENTER_Y_EM = 0.35
ZERO_DOT_SIZE = 120
QUOTE_SCALE = 1.10
PUNCT_SCALE = 1.08
IDEOGRAPHIC_SPACE_DOT_SIZE = 60

QUOTE_CODEPOINTS = (0x22, 0x27, 0x60)
PUNCT_CODEPOINTS = (0x2E, 0x2C, 0x3A, 0x3B)
HACKGEN_PUNCT_Y_SHIFT = {
    0x3B: 18,
    0x2E: 5,
    0x2C: -8,
}

LATIN_FEATURES_TO_DROP = {
    "liga",
    "clig",
    "dlig",
    "calt",
    "zero",
    *(f"cv{i:02d}" for i in range(1, 100)),
    *(f"ss{i:02d}" for i in range(1, 21)),
}

COPYRIGHT = (
    "Copyright (c) 2015-2025, Renzhi Li (aka. Belleve Invis). "
    "Portions Copyright (c) 2014-2021 Adobe Systems Incorporated. "
    "Latin glyphs derived from Hack v3.003, Copyright (c) 2018 Source Foundry Authors; "
    "portions derived from Bitstream Vera Sans Mono Copyright (c) 2003 Bitstream, Inc."
)

STYLES = {
    "Regular": (400, False, False),
    "Bold": (700, True, False),
    "Italic": (400, False, True),
    "Bold Italic": (700, True, True),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sarasa", required=True, type=Path)
    parser.add_argument("--hack", required=True, type=Path)
    parser.add_argument("--style", required=True, choices=STYLES)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--family", default=PROTOTYPE_FAMILY)
    return parser.parse_args()


def best_cmap(font: TTFont) -> dict[int, str]:
    cmap = font.getBestCmap()
    if cmap is None:
        raise RuntimeError("Font has no Unicode cmap")
    return cmap


def glyph_bounds(font: TTFont, glyph_name: str) -> tuple[float, float, float, float] | None:
    glyph_set = font.getGlyphSet()
    pen = BoundsPen(glyph_set)
    glyph_set[glyph_name].draw(pen)
    return pen.bounds


def build_transformed_glyph(
    donor: TTFont,
    glyph_name: str,
    transform: Transform,
):
    glyph_set = donor.getGlyphSet()
    recording = DecomposingRecordingPen(glyph_set)
    glyph_set[glyph_name].draw(recording)
    out_pen = TTGlyphPen(None)
    recording.replay(TransformPen(out_pen, transform))
    return out_pen.glyph()


def set_glyph_and_metrics(font: TTFont, glyph_name: str, glyph, advance: int) -> None:
    glyf = font["glyf"]
    glyf[glyph_name] = glyph
    glyph.recalcBounds(glyf)
    lsb = getattr(glyph, "xMin", 0) if getattr(glyph, "numberOfContours", 0) else 0
    font["hmtx"].metrics[glyph_name] = (int(round(advance)), int(round(lsb)))


def tune_simple_glyph(font: TTFont, glyph_name: str, scale: float, shift_y: float = 0) -> None:
    glyf = font["glyf"]
    glyph = glyf[glyph_name]
    if glyph.isComposite() or glyph.numberOfContours <= 0:
        return
    glyph.recalcBounds(glyf)
    cx = (glyph.xMin + glyph.xMax) / 2
    cy = (glyph.yMin + glyph.yMax) / 2
    coords, _, _ = glyph.getCoordinates(glyf)
    for i, (x, y) in enumerate(coords):
        coords[i] = (
            round(cx + (x - cx) * scale),
            round(cy + (y - cy) * scale + shift_y),
        )
    glyph.coordinates = coords
    glyph.recalcBounds(glyf)
    advance, _ = font["hmtx"].metrics[glyph_name]
    font["hmtx"].metrics[glyph_name] = (advance, glyph.xMin)


def contour_bboxes(glyph, glyf):
    coords, end_pts, _ = glyph.getCoordinates(glyf)
    starts = [0] + [end + 1 for end in end_pts[:-1]]
    result = []
    for index, (start, end) in enumerate(zip(starts, end_pts)):
        points = coords[start : end + 1]
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        bbox = (min(xs), min(ys), max(xs), max(ys))
        result.append((index, start, end, bbox))
    return coords, result


def tune_zero_dot(font: TTFont, glyph_name: str, cell_width: int, target_size: int) -> None:
    glyf = font["glyf"]
    glyph = glyf[glyph_name]
    if glyph.isComposite() or glyph.numberOfContours < 3:
        raise RuntimeError("Expected dotted zero with at least three simple contours")

    coords, contours = contour_bboxes(glyph, glyf)
    by_area = sorted(
        contours,
        key=lambda item: (item[3][2] - item[3][0]) * (item[3][3] - item[3][1]),
    )
    dot = by_area[0]
    outer = by_area[-1]

    _, start, end, (x_min, y_min, x_max, y_max) = dot
    _, _, _, (_, outer_y_min, _, outer_y_max) = outer
    source_w = x_max - x_min
    source_h = y_max - y_min
    if source_w <= 0 or source_h <= 0:
        raise RuntimeError("Zero dot has invalid bounds")

    source_cx = (x_min + x_max) / 2
    source_cy = (y_min + y_max) / 2
    target_cx = cell_width / 2
    target_cy = (outer_y_min + outer_y_max) / 2
    sx = target_size / source_w
    sy = target_size / source_h

    for i in range(start, end + 1):
        x, y = coords[i]
        coords[i] = (
            round(target_cx + (x - source_cx) * sx),
            round(target_cy + (y - source_cy) * sy),
        )

    glyph.coordinates = coords
    glyph.recalcBounds(glyf)
    advance, _ = font["hmtx"].metrics[glyph_name]
    font["hmtx"].metrics[glyph_name] = (advance, glyph.xMin)


def marker_centers(cell_width: int, upm: int):
    x = lambda ratio: cell_width * ratio
    y = lambda ratio: upm * ratio
    centers = []
    for ratio in (0.3, 0.4, 0.5, 0.6, 0.7):
        centers.extend(((x(ratio), y(0.65)), (x(ratio), y(0.08))))
    for ratio in (0.22, 0.32, 0.42, 0.51):
        centers.extend(((x(0.19), y(ratio)), (x(0.81), y(ratio))))
    for xr, yr in (
        (0.215, 0.61),
        (0.25, 0.635),
        (0.785, 0.61),
        (0.75, 0.635),
        (0.215, 0.12),
        (0.25, 0.095),
        (0.785, 0.12),
        (0.75, 0.095),
    ):
        centers.append((x(xr), y(yr)))
    return centers


def build_visible_ideographic_space(
    font: TTFont,
    target_name: str,
    dot_name: str,
    cell_width: int,
    upm: int,
    target_dot_size: int,
) -> None:
    glyph_set = font.getGlyphSet()
    bounds = glyph_bounds(font, dot_name)
    if not bounds:
        raise RuntimeError("U+00B7 cannot be used as U+3000 marker source")
    x_min, y_min, x_max, y_max = bounds
    width = x_max - x_min
    height = y_max - y_min
    source_size = max(width, height)
    if source_size <= 0:
        raise RuntimeError("U+00B7 marker source has invalid bounds")
    source_cx = (x_min + x_max) / 2
    source_cy = (y_min + y_max) / 2
    scale = target_dot_size / source_size

    recording = DecomposingRecordingPen(glyph_set)
    glyph_set[dot_name].draw(recording)
    out_pen = TTGlyphPen(None)
    for center_x, center_y in marker_centers(cell_width, upm):
        transform = Transform(
            scale,
            0,
            0,
            scale,
            center_x - source_cx * scale,
            center_y - source_cy * scale,
        )
        recording.replay(TransformPen(out_pen, transform))

    set_glyph_and_metrics(font, target_name, out_pen.glyph(), cell_width)


def drop_features(font: TTFont, table_tag: str, drop_tags: set[str]) -> None:
    if table_tag not in font:
        return
    table = font[table_tag].table
    feature_list = getattr(table, "FeatureList", None)
    if not feature_list:
        return

    records = feature_list.FeatureRecord
    old_to_new = {}
    kept = []
    for old_index, record in enumerate(records):
        if record.FeatureTag in drop_tags:
            continue
        old_to_new[old_index] = len(kept)
        kept.append(record)

    def remap_langsys(langsys):
        if langsys is None:
            return
        new_indices = []
        for old_index in list(langsys.FeatureIndex):
            if old_index in old_to_new:
                new_indices.append(old_to_new[old_index])
        langsys.FeatureIndex = new_indices
        langsys.FeatureCount = len(new_indices)
        required = getattr(langsys, "ReqFeatureIndex", 0xFFFF)
        if required != 0xFFFF:
            langsys.ReqFeatureIndex = old_to_new.get(required, 0xFFFF)

    script_list = getattr(table, "ScriptList", None)
    if script_list:
        for script_record in script_list.ScriptRecord:
            script = script_record.Script
            remap_langsys(getattr(script, "DefaultLangSys", None))
            for lang_record in getattr(script, "LangSysRecord", []):
                remap_langsys(lang_record.LangSys)

    feature_list.FeatureRecord = kept
    feature_list.FeatureCount = len(kept)


def set_metadata(font: TTFont, family: str, style: str) -> None:
    weight, is_bold, is_italic = STYLES[style]
    name = font["name"]
    postscript_style = style.replace(" ", "")
    full_name = family if style == "Regular" else f"{family} {style}"
    postscript_name = f"{family.replace(' ', '')}-{postscript_style}"

    for lang_id in (0x0409, 0x0411):
        name.setName(COPYRIGHT, 0, 3, 1, lang_id)
        name.setName(family, 1, 3, 1, lang_id)
        name.setName(style, 2, 3, 1, lang_id)
        name.setName(f"{family} {style}", 3, 3, 1, lang_id)
        name.setName(full_name, 4, 3, 1, lang_id)
        name.setName(f"Version {PROTOTYPE_VERSION}", 5, 3, 1, lang_id)
        name.setName(family, 16, 3, 1, lang_id)
        name.setName(style, 17, 3, 1, lang_id)
    name.setName(postscript_name, 6, 3, 1, 0x0409)

    os2 = font["OS/2"]
    os2.usWeightClass = weight
    os2.fsSelection &= ~(0x0001 | 0x0020 | 0x0040)
    os2.fsSelection |= 0x0080  # USE_TYPO_METRICS
    if is_italic:
        os2.fsSelection |= 0x0001
    if is_bold:
        os2.fsSelection |= 0x0020
    if not is_bold and not is_italic:
        os2.fsSelection |= 0x0040

    head = font["head"]
    head.macStyle &= ~0x0003
    if is_bold:
        head.macStyle |= 0x0001
    if is_italic:
        head.macStyle |= 0x0002

    if "post" in font:
        font["post"].isFixedPitch = 1


def validate(font: TTFont, style: str) -> None:
    cmap = best_cmap(font)
    hmtx = font["hmtx"].metrics
    half = hmtx[cmap[0x30]][0]
    full = hmtx[cmap[0x3042]][0]
    if full != half * 2:
        raise RuntimeError(f"1:2 validation failed: half={half}, full={full}")
    for cp in range(0x20, 0x7F):
        if hmtx[cmap[cp]][0] != half:
            raise RuntimeError(f"ASCII width mismatch at U+{cp:04X}")
    if hmtx[cmap[0x3000]][0] != full:
        raise RuntimeError("U+3000 width mismatch")

    weight, is_bold, is_italic = STYLES[style]
    os2 = font["OS/2"]
    if os2.usWeightClass != weight:
        raise RuntimeError(f"Weight mismatch: {os2.usWeightClass} != {weight}")
    if bool(os2.fsSelection & 0x0001) != is_italic:
        raise RuntimeError("Italic fsSelection mismatch")
    if bool(os2.fsSelection & 0x0020) != is_bold:
        raise RuntimeError("Bold fsSelection mismatch")


def main() -> None:
    args = parse_args()
    if not args.sarasa.is_file() or not args.hack.is_file():
        raise FileNotFoundError("Input TTF not found")

    base = TTFont(args.sarasa, recalcBBoxes=True, recalcTimestamp=False)
    donor = TTFont(args.hack, recalcBBoxes=True, recalcTimestamp=False)
    base_cmap = best_cmap(base)
    donor_cmap = best_cmap(donor)

    required_base = (0x30, 0x00B7, 0x3000, 0x3042)
    if any(cp not in base_cmap for cp in required_base):
        raise RuntimeError("Sarasa base is missing U+0030/U+00B7/U+3000/U+3042")

    base_upm = base["head"].unitsPerEm
    donor_upm = donor["head"].unitsPerEm
    half_width = base["hmtx"].metrics[base_cmap[0x30]][0]
    full_width = base["hmtx"].metrics[base_cmap[0x3042]][0]
    if full_width != half_width * 2:
        raise RuntimeError(
            f"Base is not 1:2 monospace: half={half_width}, full={full_width}"
        )

    rebase = base_upm / donor_upm
    scale_x = (
        HACKGEN_REFERENCE_SCALE_X
        * (half_width / HACKGEN_REFERENCE_HALF_WIDTH)
        * (HACKGEN_REFERENCE_EM / base_upm)
    )
    scale_y = HACKGEN_REFERENCE_SCALE_Y
    visual_center_x = half_width / 2
    visual_center_y = base_upm * LATIN_VISUAL_CENTER_Y_EM

    replaced = 0
    for cp in range(0x20, 0x7F):
        if cp not in donor_cmap or cp not in base_cmap:
            raise RuntimeError(f"Missing Basic Latin glyph U+{cp:04X}")
        src_name = donor_cmap[cp]
        dst_name = base_cmap[cp]
        donor_advance = donor["hmtx"].metrics[src_name][0] * rebase
        shift_x = (half_width - donor_advance * scale_x) / 2

        total_x = rebase * scale_x * LATIN_VISUAL_SCALE
        total_y = rebase * scale_y * LATIN_VISUAL_SCALE
        offset_x = visual_center_x + (shift_x - visual_center_x) * LATIN_VISUAL_SCALE
        offset_y = visual_center_y * (1 - LATIN_VISUAL_SCALE)
        transform = Transform(total_x, 0, 0, total_y, offset_x, offset_y)
        glyph = build_transformed_glyph(donor, src_name, transform)
        set_glyph_and_metrics(base, dst_name, glyph, half_width)
        if cp == 0x30:
            tune_zero_dot(base, dst_name, half_width, ZERO_DOT_SIZE)
        replaced += 1

    for cp in QUOTE_CODEPOINTS:
        tune_simple_glyph(base, base_cmap[cp], QUOTE_SCALE)
    for cp in PUNCT_CODEPOINTS:
        shift_reference = HACKGEN_PUNCT_Y_SHIFT.get(cp, 0)
        shift_y = shift_reference * base_upm / HACKGEN_REFERENCE_EM
        tune_simple_glyph(base, base_cmap[cp], PUNCT_SCALE, shift_y)

    build_visible_ideographic_space(
        base,
        base_cmap[0x3000],
        base_cmap[0x00B7],
        full_width,
        base_upm,
        IDEOGRAPHIC_SPACE_DOT_SIZE,
    )

    drop_features(base, "GSUB", LATIN_FEATURES_TO_DROP)
    drop_features(base, "GPOS", LATIN_FEATURES_TO_DROP)
    set_metadata(base, args.family, args.style)
    validate(base, args.style)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    base.save(args.output)

    check = TTFont(args.output, recalcBBoxes=True, recalcTimestamp=False)
    validate(check, args.style)
    print(f"Built: {args.output}")
    print(f"Style: {args.style}")
    print(f"Replaced Basic Latin glyphs: {replaced}")
    print(f"UPM: {base_upm}")
    print(f"Half/full width: {half_width}/{full_width} (1:2 OK)")
    print(f"HackGen-reference scaling: x={scale_x:.6f}, y={scale_y:.6f}")
    print(f"Latin visual scale: {LATIN_VISUAL_SCALE:.3f}")
    print(f"Zero dot target: {ZERO_DOT_SIZE}x{ZERO_DOT_SIZE}")
    print(f"Visible U+3000 marker dot size: {IDEOGRAPHIC_SPACE_DOT_SIZE}")


if __name__ == "__main__":
    main()
