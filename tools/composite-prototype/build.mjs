import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { CliProc, Ot } from "ot-builder";

import { dropFeature } from "../../make/helpers/drop.mjs";
import {
	alterContours,
	copyGeometryData,
	getAdvanceWidth,
	setAdvanceWidth,
} from "../../make/helpers/geometry.mjs";
import { readFont, writeFont } from "../../make/helpers/font-io.mjs";
import { setFontMetadata } from "../../make/pass1/metadata.mjs";

const PROTOTYPE_FAMILY = "Composite Code JP Prototype V2";
const PROTOTYPE_VERSION = "0.0.2-prototype";

// HackGen 2.x reference geometry, adapted from UPM 1024 / half-width 540
// to Sarasa Mono's actual UPM and half-width at build time.
const HACKGEN_REFERENCE = {
	em: 1024,
	halfWidth: 540,
	scaleX: 0.88,
	scaleY: 0.97,
};

// Visual tuning accepted after rendering the first Regular prototype.
// Advance widths stay unchanged, so the strict 1:2 cell ratio is preserved.
const LATIN_VISUAL_SCALE = 1.03;
const LATIN_VISUAL_CENTER_Y_EM = 0.35;
const ZERO_DOT_SIZE = 120;

const LATIN_FEATURES_TO_DROP = [
	"liga",
	"clig",
	"dlig",
	"calt",
	"zero",
	...Array.from({ length: 99 }, (_, i) => `cv${String(i + 1).padStart(2, "0")}`),
	...Array.from({ length: 20 }, (_, i) => `ss${String(i + 1).padStart(2, "0")}`),
];

const COPYRIGHT =
	"Copyright (c) 2015-2025, Renzhi Li (aka. Belleve Invis). " +
	"Portions Copyright (c) 2014-2021 Adobe Systems Incorporated. " +
	"Latin glyphs derived from Hack v3.003, Copyright (c) 2018 Source Foundry Authors; " +
	"portions derived from Bitstream Vera Sans Mono Copyright (c) 2003 Bitstream, Inc.";

const { values } = parseArgs({
	options: {
		sarasa: { type: "string", short: "s" },
		hack: { type: "string", short: "h" },
		output: { type: "string", short: "o" },
	},
});

if (!values.sarasa || !values.hack || !values.output) {
	throw new Error(
		"Usage: node tools/composite-prototype/build.mjs --sarasa SarasaMonoJ-Regular.ttf --hack Hack-Regular.ttf --output CompositeCodeJPProtoV2-Regular.ttf",
	);
}

const sarasaPath = path.resolve(values.sarasa);
const hackPath = path.resolve(values.hack);
const outputPath = path.resolve(values.output);

await Promise.all([fs.access(sarasaPath), fs.access(hackPath)]);

const base = await readFont(sarasaPath);
const donor = await readFont(hackPath);

if (donor.head.unitsPerEm !== base.head.unitsPerEm) {
	CliProc.rebaseFont(donor, base.head.unitsPerEm);
}

const baseZero = base.cmap.unicode.get(0x30);
const baseHiraganaA = base.cmap.unicode.get(0x3042);
if (!baseZero || !baseHiraganaA) {
	throw new Error("Sarasa base is missing U+0030 or U+3042; expected Sarasa Mono J.");
}

const halfWidth = getAdvanceWidth(baseZero);
const fullWidth = getAdvanceWidth(baseHiraganaA);
if (fullWidth !== halfWidth * 2) {
	throw new Error(
		`Base font is not 1:2 monospace: half=${halfWidth}, full=${fullWidth}. Refusing to build.`,
	);
}

const scaleX =
	HACKGEN_REFERENCE.scaleX *
	(halfWidth / HACKGEN_REFERENCE.halfWidth) *
	(HACKGEN_REFERENCE.em / base.head.unitsPerEm);
const scaleY = HACKGEN_REFERENCE.scaleY;
const visualCenterX = halfWidth / 2;
const visualCenterY = base.head.unitsPerEm * LATIN_VISUAL_CENTER_Y_EM;

let replaced = 0;
for (let cp = 0x20; cp <= 0x7e; cp += 1) {
	const src = donor.cmap.unicode.get(cp);
	const dst = base.cmap.unicode.get(cp);
	if (!src || !dst) {
		throw new Error(`Missing Basic Latin glyph U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
	}

	const donorAdvance = getAdvanceWidth(src);
	const shiftX = (halfWidth - donorAdvance * scaleX) / 2;
	alterContours(src, (x, y) => {
		const xHackGen = x * scaleX + shiftX;
		const yHackGen = y * scaleY;
		return [
			visualCenterX + (xHackGen - visualCenterX) * LATIN_VISUAL_SCALE,
			visualCenterY + (yHackGen - visualCenterY) * LATIN_VISUAL_SCALE,
		];
	});

	const originalVertical = dst.vertical ? { ...dst.vertical } : null;
	copyGeometryData(dst, src);
	setAdvanceWidth(dst, halfWidth);
	if (originalVertical) dst.vertical = originalVertical;
	dst.hints = null;

	if (cp === 0x30) tuneZeroDot(dst, halfWidth, ZERO_DOT_SIZE);
	replaced += 1;
}

// Prevent Iosevka character variants/ligatures (including the optional zero feature)
// from swapping the new Hack defaults back to Iosevka glyphs. CJK-specific features
// such as locl/vert are retained.
if (base.gsub) dropFeature(base.gsub, LATIN_FEATURES_TO_DROP);
if (base.gpos) dropFeature(base.gpos, LATIN_FEATURES_TO_DROP);

setFontMetadata(
	base,
	true,
	["en_US", "ja_JP"],
	{ jis: true, gbk: false, big5: false, korean: false },
	{
		en_US: {
			copyright: COPYRIGHT,
			version: `Version ${PROTOTYPE_VERSION}`,
			family: PROTOTYPE_FAMILY,
			style: "Regular",
		},
		ja_JP: {
			family: PROTOTYPE_FAMILY,
			style: "Regular",
		},
	},
);

CliProc.gcFont(base, Ot.ListGlyphStoreFactory);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await writeFont(outputPath, base);

// Re-open the actual output so validation catches serialization regressions.
const check = await readFont(outputPath);
const checkHalf = getAdvanceWidth(check.cmap.unicode.get(0x30));
const checkFull = getAdvanceWidth(check.cmap.unicode.get(0x3042));
if (checkFull !== checkHalf * 2) {
	throw new Error(`Output failed 1:2 validation: half=${checkHalf}, full=${checkFull}`);
}
for (let cp = 0x20; cp <= 0x7e; cp += 1) {
	const glyph = check.cmap.unicode.get(cp);
	if (!glyph || getAdvanceWidth(glyph) !== checkHalf) {
		throw new Error(`Output Basic Latin width mismatch at U+${cp.toString(16).toUpperCase()}`);
	}
}

const zeroCheck = inspectZeroDot(check.cmap.unicode.get(0x30));
const expectedZeroCenterX = checkHalf / 2;
const expectedZeroCenterY = (zeroCheck.outer.yMin + zeroCheck.outer.yMax) / 2;
const tolerance = 2;
if (
	Math.abs(zeroCheck.dot.width - ZERO_DOT_SIZE) > tolerance ||
	Math.abs(zeroCheck.dot.height - ZERO_DOT_SIZE) > tolerance ||
	Math.abs(zeroCheck.dot.centerX - expectedZeroCenterX) > tolerance ||
	Math.abs(zeroCheck.dot.centerY - expectedZeroCenterY) > tolerance
) {
	throw new Error(
		`Output zero-dot validation failed: ${JSON.stringify({
			dot: zeroCheck.dot,
			expectedCenterX: expectedZeroCenterX,
			expectedCenterY: expectedZeroCenterY,
		})}`,
	);
}

console.log(`Built ${outputPath}`);
console.log(`Replaced Basic Latin glyphs: ${replaced}`);
console.log(`UPM: ${check.head.unitsPerEm}`);
console.log(`Half/full width: ${checkHalf}/${checkFull} (1:2 OK)`);
console.log(`HackGen-reference scaling: x=${scaleX.toFixed(6)}, y=${scaleY.toFixed(6)}`);
console.log(`Latin visual scale: ${LATIN_VISUAL_SCALE.toFixed(3)} around y=${visualCenterY.toFixed(1)}`);
console.log(
	`Zero dot: ${zeroCheck.dot.width.toFixed(1)}x${zeroCheck.dot.height.toFixed(1)}, center=(${zeroCheck.dot.centerX.toFixed(1)}, ${zeroCheck.dot.centerY.toFixed(1)})`,
);

function tuneZeroDot(glyph, cellWidth, targetSize) {
	const inspected = inspectZeroDot(glyph);
	const contours = inspected.contours;
	const dotIndex = inspected.dot.index;
	const dot = contours[dotIndex];
	const source = inspected.dot;
	const targetCenterX = cellWidth / 2;
	const targetCenterY = (inspected.outer.yMin + inspected.outer.yMax) / 2;
	const sx = targetSize / source.width;
	const sy = targetSize / source.height;

	for (const point of dot) {
		point.x = targetCenterX + (point.x - source.centerX) * sx;
		point.y = targetCenterY + (point.y - source.centerY) * sy;
	}
	glyph.geometry = new Ot.Glyph.ContourSet(contours);
}

function inspectZeroDot(glyph) {
	if (!glyph?.geometry) throw new Error("U+0030 has no outline geometry.");
	const contours = Ot.GeometryUtil.apply(Ot.GeometryUtil.Flattener, glyph.geometry);
	if (contours.length < 3) {
		throw new Error(`U+0030 expected at least 3 contours, found ${contours.length}.`);
	}

	const bounds = contours.map((contour, index) => contourBounds(contour, index));
	const byArea = [...bounds].sort((a, b) => a.area - b.area);
	return {
		contours,
		dot: byArea[0],
		outer: byArea[byArea.length - 1],
	};
}

function contourBounds(contour, index) {
	let xMin = Infinity;
	let xMax = -Infinity;
	let yMin = Infinity;
	let yMax = -Infinity;
	for (const point of contour) {
		xMin = Math.min(xMin, point.x);
		xMax = Math.max(xMax, point.x);
		yMin = Math.min(yMin, point.y);
		yMax = Math.max(yMax, point.y);
	}
	const width = xMax - xMin;
	const height = yMax - yMin;
	return {
		index,
		xMin,
		xMax,
		yMin,
		yMax,
		width,
		height,
		area: width * height,
		centerX: (xMin + xMax) / 2,
		centerY: (yMin + yMax) / 2,
	};
}
