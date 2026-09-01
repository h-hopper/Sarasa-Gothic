import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { readFont, writeFont } from "../../make/helpers/font-io.mjs";
import { setFontMetadata } from "../../make/pass1/metadata.mjs";

const PROTOTYPE_FAMILY = "Composite Code JP Prototype V3";
const PROTOTYPE_VERSION = "0.0.3-prototype";
const SUPPORTED_STYLES = new Set(["Regular", "Bold", "Italic", "Bold Italic"]);
const COPYRIGHT =
	"Copyright (c) 2015-2025, Renzhi Li (aka. Belleve Invis). " +
	"Portions Copyright (c) 2014-2021 Adobe Systems Incorporated. " +
	"Latin glyphs derived from Hack v3.003, Copyright (c) 2018 Source Foundry Authors; " +
	"portions derived from Bitstream Vera Sans Mono Copyright (c) 2003 Bitstream, Inc.";

const { values } = parseArgs({
	options: {
		input: { type: "string", short: "i" },
		output: { type: "string", short: "o" },
		style: { type: "string", short: "s" },
	},
});

if (!values.input || !values.output || !values.style) {
	throw new Error(
		"Usage: node tools/composite-prototype/retag-style.mjs --input input.ttf --output output.ttf --style 'Bold Italic'",
	);
}
if (!SUPPORTED_STYLES.has(values.style)) {
	throw new Error(`Unsupported style: ${values.style}`);
}

const inputPath = path.resolve(values.input);
const outputPath = path.resolve(values.output);
await fs.access(inputPath);

const font = await readFont(inputPath);
setFontMetadata(
	font,
	true,
	["en_US", "ja_JP"],
	{ jis: true, gbk: false, big5: false, korean: false },
	{
		en_US: {
			copyright: COPYRIGHT,
			version: `Version ${PROTOTYPE_VERSION}`,
			family: PROTOTYPE_FAMILY,
			style: values.style,
		},
		ja_JP: {
			family: PROTOTYPE_FAMILY,
			style: values.style,
		},
	},
);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await writeFont(outputPath, font);

const check = await readFont(outputPath);
const expectedBold = values.style.includes("Bold");
const expectedItalic = values.style.includes("Italic");
const expectedWeight = expectedBold ? 700 : 400;
if (check.os2.usWeightClass !== expectedWeight) {
	throw new Error(
		`Unexpected OS/2 weight after retagging ${values.style}: ${check.os2.usWeightClass}, expected ${expectedWeight}`,
	);
}

// OpenType OS/2.fsSelection: bit 0 = ITALIC, bit 5 = BOLD.
const hasItalicBit = Boolean(check.os2.fsSelection & 0x01);
const hasBoldBit = Boolean(check.os2.fsSelection & 0x20);
if (hasItalicBit !== expectedItalic) {
	throw new Error(
		`Unexpected OS/2 italic flag after retagging ${values.style}: ${hasItalicBit}, expected ${expectedItalic}`,
	);
}
if (hasBoldBit !== expectedBold) {
	throw new Error(
		`Unexpected OS/2 bold flag after retagging ${values.style}: ${hasBoldBit}, expected ${expectedBold}`,
	);
}

console.log(`Retagged ${inputPath} -> ${outputPath}`);
console.log(`Family: ${PROTOTYPE_FAMILY}`);
console.log(`Style: ${values.style}`);
console.log(`OS/2 weight: ${check.os2.usWeightClass}`);
console.log(`OS/2 flags: italic=${hasItalicBit}, bold=${hasBoldBit}`);
