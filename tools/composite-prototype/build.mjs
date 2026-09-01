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

const PROTOTYPE_FAMILY = "Composite Code JP Prototype V3";
const PROTOTYPE_VERSION = "0.0.3-prototype";

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

// Additional HackGen-inspired optical corrections for small ASCII punctuation.
// These are applied after the general +3% Latin tuning.
const QUOTE_SCALE = 1.10;
const PUNCT_SCALE = 1.08;
const HACKGEN_PUNCT_Y_SHIFT = new Map([
	[0x3b, 18], // ;
	[0x2e, 5], // .
	[0x2c, -8], // ,
]);
const QUOTE_CODEPOINTS = [0x22, 0x27, 0x60]; // " ' `
const PUNCT_CODEPOINTS = [0x2e, 0x2c, 0x3a, 0x3b]; // . , : ;

// Visible U+3000 marker. HackGen uses a dotted rounded rectangle; this prototype
// keeps the same idea but uses a deliberately restrained 60-unit dot size.
const IDEOGRAPHIC_SPACE_DOT_SIZE = 60;

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
		"Usage: node tools/composite-prototype/build.mjs --sarasa SarasaMonoJ-Regular.ttf --hack Hack-Regular.ttf --output CompositeCodeJPProtoV3-Regular.ttf",
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
const ideographicSpace = base.cmap.unicode.get(0x3000);
const periodCentered = base.cmap.unicode.get(0x00b7);
if (!baseZero || !baseHiraganaA || !ideographicSpace || !periodCentered) {
	throw new Error(
		"Sarasa base is missing one of U+0030, U+00B7, U+3000, or U+3042; expected Sarasa Mono J.",
	);
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

for (const cp of QUOTE_CODEPOINTS) {
	tuneGlyphAroundOwnBounds(base.cmap.unicode.get(cp), QUOTE_SCALE, 0);
}
for (const cp of PUNCT_CODEPOINTS) {
	const shiftReference = HACKGEN_PUNCT_Y_SHIFT.get(cp) ?? 0;
	const shiftY = (shiftReference * base.head.unitsPerEm) / HACKGEN_REFERENCE.em;
	tuneGlyphAroundOwnBounds(base.cmap.unicode.get(cp), PUNCT_SCALE, shiftY);
}

buildVisibleIdeographicSpace(
	ideographicSpace,
	periodCentered,
	fullWidth,
	base.head.unitsPerEm,
	IDEOGRAPHIC_SPACE_DOT_SIZE,
);

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

const spaceCheck = inspectGlyph(check.cmap.unicode.get(0x3000));
if (!spaceCheck.contours.length || getAdvanceWidth(check.cmap.unicode.get(0x3000)) !== checkFull) {
	throw new Error("Output U+3000 marker is missing or has the wrong advance width.");
}
if (Math.abs(spaceCheck.centerX - checkFull / 2) > tolerance) {
	throw new Error(
		`Output U+3000 marker is not horizontally centered: center=${spaceCheck.centerX}, expected=${checkFull / 2}`,
	);
}

console.log(`Built ${outputPath}`);
console.log(`Replaced Basic Latin glyphs: ${replaced}`);
console.log(`UPM: ${check.head.unitsPerEm}`);
console.log(`Half/full width: ${checkHalf}/${checkFull} (1:2 OK)`);
console.log(`HackGen-reference scaling: x=${scaleX.toFixed(6)}, y=${scaleY.toFixed(6)}`);
console.log(`Latin visual scale: ${LATIN_VISUAL_SCALE.toFixed(3)} around y=${visualCenterY.toFixed(1)}`);
console.log(`Quote optical scale: ${QUOTE_SCALE.toFixed(2)}`);
console.log(`Punctuation optical scale: ${PUNCT_SCALE.toFixed(2)} with HackGen-reference Y shifts`);
console.log(
	`Zero dot: ${zeroCheck.dot.width.toFixed(1)}x${zeroCheck.dot.height.toFixed(1)}, center=(${zeroCheck.dot.centerX.toFixed(1)}, ${zeroCheck.dot.centerY.toFixed(1)})`,
);
console.log(
	`U+3000 marker: contours=${spaceCheck.contours.length}, bbox=(${spaceCheck.xMin.toFixed(1)}, ${spaceCheck.yMin.toFixed(1)})..(${spaceCheck.xMax.toFixed(1)}, ${spaceCheck.yMax.toFixed(1)}), centerX=${spaceCheck.centerX.toFixed(1)}`,
);

function tuneGlyphAroundOwnBounds(glyph, scale, shiftY) {
	if (!glyph?.geometry) return;
	const inspected = inspectGlyph(glyph);
	const contours = inspected.contours;
	for (const contour of contours) {
		for (let i = 0; i < contour.length; i += 1) {
			const point = contour[i];
			contour[i] = Ot.Glyph.Point.create(
				inspected.centerX + (point.x - inspected.centerX) * scale,
				inspected.centerY + (point.y - inspected.centerY) * scale + shiftY,
				point.kind,
			);
		}
	}
	glyph.geometry = new Ot.Glyph.ContourSet(contours);
	glyph.hints = null;
}

function buildVisibleIdeographicSpace(target, dotSource, cellWidth, upm, targetDotSize) {
	const source = inspectGlyph(dotSource);
	const sourceSize = Math.max(source.width, source.height);
	if (!sourceSize) throw new Error("U+00B7 cannot be used as U+3000 marker source.");
	const scale = targetDotSize / sourceSize;
	const centers = ideographicSpaceMarkerCenters(cellWidth, upm);
	const contours = [];

	for (const [centerX, centerY] of centers) {
		for (const sourceContour of source.contours) {
			const transformed = sourceContour.map((point) =>
				Ot.Glyph.Point.create(
					centerX + (point.x - source.centerX) * scale,
					centerY + (point.y - source.centerY) * scale,
					point.kind,
				),
			);
			contours.push(transformed);
		}
	}

	target.geometry = new Ot.Glyph.ContourSet(contours);
	setAdvanceWidth(target, cellWidth);
	target.hints = null;
}

function ideographicSpaceMarkerCenters(cellWidth, upm) {
	const x = (ratio) => cellWidth * ratio;
	const y = (ratio) => upm * ratio;
	const centers = [];

	// Top and bottom straight sections.
	for (const ratio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
		centers.push([x(ratio), y(0.65)], [x(ratio), y(0.08)]);
	}

	// Left and right straight sections.
	for (const ratio of [0.22, 0.32, 0.42, 0.51]) {
		centers.push([x(0.19), y(ratio)], [x(0.81), y(ratio)]);
	}

	// Rounded-corner transition dots.
	for (const [xr, yr] of [
		[0.215, 0.61],
		[0.25, 0.635],
		[0.785, 0.61],
		[0.75, 0.635],
		[0.215, 0.12],
		[0.25, 0.095],
		[0.785, 0.12],
		[0.75, 0.095],
	]) {
		centers.push([x(xr), y(yr)]);
	}

	return centers;
}

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

	for (let i = 0; i < dot.length; i += 1) {
		const point = dot[i];
		dot[i] = Ot.Glyph.Point.create(
			targetCenterX + (point.x - source.centerX) * sx,
			targetCenterY + (point.y - source.centerY) * sy,
			point.kind,
		);
	}
	glyph.geometry = new Ot.Glyph.ContourSet(contours);
}

function inspectZeroDot(glyph) {
	const inspected = inspectGlyph(glyph);
	if (inspected.contours.length < 3) {
		throw new Error(`U+0030 expected at least 3 contours, found ${inspected.contours.length}.`);
	}

	const bounds = inspected.contours.map((contour, index) => contourBounds(contour, index));
	const byArea = [...bounds].sort((a, b) => a.area - b.area);
	return {
		contours: inspected.contours,
		dot: byArea[0],
		outer: byArea[byArea.length - 1],
	};
}

function inspectGlyph(glyph) {
	if (!glyph?.geometry) throw new Error("Glyph has no outline geometry.");
	const contours = Ot.GeometryUtil.apply(Ot.GeometryUtil.Flattener, glyph.geometry);
	let xMin = Infinity;
	let xMax = -Infinity;
	let yMin = Infinity;
	let yMax = -Infinity;
	for (const contour of contours) {
		for (const point of contour) {
			xMin = Math.min(xMin, point.x);
			xMax = Math.max(xMax, point.x);
			yMin = Math.min(yMin, point.y);
			yMax = Math.max(yMax, point.y);
		}
	}
	if (!contours.length || !Number.isFinite(xMin)) {
		return {
			contours,
			xMin: 0,
			xMax: 0,
			yMin: 0,
			yMax: 0,
			width: 0,
			height: 0,
			centerX: 0,
			centerY: 0,
		};
	}
	return {
		contours,
		xMin,
		xMax,
		yMin,
		yMax,
		width: xMax - xMin,
		height: yMax - yMin,
		centerX: (xMin + xMax) / 2,
		centerY: (yMin + yMax) / 2,
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
