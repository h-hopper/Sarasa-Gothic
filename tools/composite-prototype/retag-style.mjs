import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { readFont, writeFont } from "../../make/helpers/font-io.mjs";
import { setFontMetadata } from "../../make/pass1/metadata.mjs";

const PROTOTYPE_FAMILY = "Composite Code JP Prototype V3";
const PROTOTYPE_VERSION = "0.0.3-prototype";
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
		"Usage: node tools/composite-prototype/retag-style.mjs --input input.ttf --output output.ttf --style Bold",
	);
}
if (!new Set(["Regular", "Bold"]).has(values.style)) {
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
const expectedWeight = values.style === "Bold" ? 700 : 400;
if (check.os2.usWeightClass !== expectedWeight) {
	throw new Error(
		`Unexpected OS/2 weight after retagging ${values.style}: ${check.os2.usWeightClass}, expected ${expectedWeight}`,
	);
}

console.log(`Retagged ${inputPath} -> ${outputPath}`);
console.log(`Family: ${PROTOTYPE_FAMILY}`);
console.log(`Style: ${values.style}`);
console.log(`OS/2 weight: ${check.os2.usWeightClass}`);
