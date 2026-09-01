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

const PROTOTYPE_FAMILY = "Composite Code JP Prototype";
const PROTOTYPE_VERSION = "0.0.1-prototype";

// HackGen 2.x reference geometry, adapted from UPM 1024 / half-width 540
// to Sarasa Mono's actual UPM and half-width at build time.
const HACKGEN_REFERENCE = {
	em: 1024,
	halfWidth: 540,
	scaleX: 0.88,
	scaleY: 0.97,
};

const LATIN_FEATURES_TO_DROP = [
	"liga",
	"clig",
	"dlig",
	"calt",
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
		"Usage: node tools/composite-prototype/build.mjs --sarasa SarasaMonoJ-Regular.ttf --hack Hack-Regular.ttf --output CompositeCodeJPProto-Regular.ttf",
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

let replaced = 0;
for (let cp = 0x20; cp <= 0x7e; cp += 1) {
	const src = donor.cmap.unicode.get(cp);
	const dst = base.cmap.unicode.get(cp);
	if (!src || !dst) {
		throw new Error(`Missing Basic Latin glyph U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
	}

	const donorAdvance = getAdvanceWidth(src);
	const shiftX = (halfWidth - donorAdvance * scaleX) / 2;
	alterContours(src, (x, y) => [x * scaleX + shiftX, y * scaleY]);

	const originalVertical = dst.vertical ? { ...dst.vertical } : null;
	copyGeometryData(dst, src);
	setAdvanceWidth(dst, halfWidth);
	if (originalVertical) dst.vertical = originalVertical;
	dst.hints = null;
	replaced += 1;
}

// Prevent Iosevka character variants/ligatures from swapping the new Hack defaults
// back to Iosevka glyphs. CJK-specific features such as locl/vert are retained.
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

console.log(`Built ${outputPath}`);
console.log(`Replaced Basic Latin glyphs: ${replaced}`);
console.log(`UPM: ${check.head.unitsPerEm}`);
console.log(`Half/full width: ${checkHalf}/${checkFull} (1:2 OK)`);
console.log(`HackGen-reference scaling: x=${scaleX.toFixed(6)}, y=${scaleY.toFixed(6)}`);
