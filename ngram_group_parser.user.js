// ==UserScript==
// @name        edrdg N-gram group parser
// @namespace   edrdg-scripts
// @version     1.0
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/ngramcounts*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       GM_setClipboard
// @run-at      document-end
// ==/UserScript==
'use strict';


function partsToSearchTokens(parts) {
	let tokens = [""];
	for (const part of parts) {
		if (Array.isArray(part)) {
			let newTokens = [];
			for (const innerPart of part) {
				newTokens = newTokens.concat(tokens.map(token => token + innerPart));
			}
			tokens = newTokens;
		} else {
			tokens = tokens.map(token => token + part);
		}
	}
	return tokens.join("；");
}


function partsToNormalizedString(parts) {
	let normalized_string = "";
	parts.forEach(part => {
		if (Array.isArray(part)) {
			normalized_string += `｛${part.join("／")}｝`;
		} else {
			normalized_string += part;
		}
	})
	return normalized_string;
}


function insertIntoTable(parts) {
	const normalized_string = partsToNormalizedString(parts);

	let table = document.querySelector("#groupTable");
	if (table === null) {
		table = document.createElement("table");
		table.id = "groupTable";
		document.body.append(table);
	}
	const text_cell = document.createElement("td");
	text_cell.innerText = normalized_string;

	const copy_button = document.createElement("button");
	copy_button.type = "button";
	copy_button.innerText = "Copy";
	copy_button.minWidth = "75px";
	copy_button.addEventListener('click', copyGroupText);
	const copy_cell = document.createElement("td");
	copy_cell.appendChild(copy_button);

	const row = table.insertRow();
	row.append(text_cell);
	row.append(copy_cell);
}


function copyGroupText(e) {
	const tableRow = e.target.parentElement.parentElement;
	const text = tableRow.cells[0].innerText;
	GM_setClipboard(text);
}


function parseGroups() {
	const textBox = document.querySelector("input");
	const text = textBox.value;

	const open = "{｛";
	const close = "}｝";
	const inner_delims = " ,、.。;；／";

	if (!text.match(`[${open}]`)) {
		return;
	} else if (!text.match(`[${close}]`)) {
		return;
	} else if (text.match(`[${inner_delims}][^${close}]*[${open}]`)) {
		return;
	} else if (text.match(`[${close}][^${open}]*[${inner_delims}]`)) {
		return;
	}

	const outer_re = `([^${open}]*)(?:[${open}]([^${open}]+)[${close}])?`;
	const inner_re = `([^${inner_delims}]+)[${inner_delims}]?`;
	const parts = [];

	for (const outer_match of text.matchAll(outer_re)) {
		parts.push(outer_match[1]);
		if (outer_match[2] === undefined) {
			continue;
		}
		const inner_parts = [];
		for (const inner_match of outer_match[2].matchAll(inner_re)) {
			inner_parts.push(inner_match[1]);
		}
		parts.push(inner_parts);
	}

	const newText = partsToSearchTokens(parts);
	textBox.value = newText;

	insertIntoTable(parts);
}


function main() {
	const parse_button = document.createElement("button");
	parse_button.type = "button";
	parse_button.innerText = "Expand Groups";
	parse_button.addEventListener('click', parseGroups);

	const breaks = document.querySelectorAll("br");
	const final_break = breaks[breaks.length - 1];
	final_break.before(" ");
	final_break.before(parse_button);

	const style = document.createElement('style');
	style.innerText = `
          td {
              border: 1px solid;
              padding: 5px;
          }
          table {
            max-width: 800px;
            border-collapse: collapse;
          }`;
	document.head.appendChild(style);
}


main();
