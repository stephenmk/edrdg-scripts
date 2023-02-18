// ==UserScript==
// @name        edrdg N-gram group parser
// @namespace   edrdg-scripts
// @version     1.1
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/ngramcounts*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       GM_setClipboard
// @run-at      document-end
// ==/UserScript==
'use strict';


function partsToSearchTerms(parts) {
	let terms = [""];
	for (const part of parts) {
		if (Array.isArray(part)) {
			let newTerms = [];
			for (const innerPart of part) {
				newTerms = newTerms.concat(terms.map(term => term + innerPart));
			}
			terms = newTerms;
		} else {
			terms = terms.map(term => term + part);
		}
	}
	return terms;
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


function groupTable() {
	const queryTable = document.querySelector("#groupTable");
	if (queryTable !== null) {
		return queryTable;
	}

	const headCell1 = document.createElement("th");
	const headCell2 = document.createElement("th");
	const headCell3 = document.createElement("th");
	headCell1.innerText = "Term Count"
	headCell2.innerText = "Group Expression"
	headCell3.classList.add("button-cell")

	const table = document.createElement("table");
	table.id = "groupTable";

	const headRow = table.insertRow();
	headRow.append(headCell1, headCell2, headCell3);
	document.body.appendChild(table);

	return table;
}


function insertIntoTable(parts) {
	const count_cell = document.createElement("td");
	count_cell.innerText = partsToSearchTerms(parts).length;
	count_cell.classList.add("count-cell");

	const exp_cell = document.createElement("td");
	exp_cell.innerText = partsToNormalizedString(parts);

	const copy_button = document.createElement("button");
	copy_button.type = "button";
	copy_button.innerText = "Copy";
	copy_button.addEventListener('click', copyGroupText);
	const copy_cell = document.createElement("td");
	copy_cell.appendChild(copy_button);
	copy_cell.classList.add("button-cell");

	const table = groupTable();
	const row = table.insertRow();
	row.append(count_cell, exp_cell, copy_cell);
}


function copyGroupText(e) {
	const tableRow = e.target.parentElement.parentElement;
	const text = tableRow.cells[1].innerText;
	GM_setClipboard(text);
}


function parseGroups() {
	const textBox = document.querySelector("input");
	const text = textBox.value;

	const open = "{｛(（";
	const close = "}｝)）";
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

	const terms = partsToSearchTerms(parts);
	textBox.value = terms.join("；");

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
          .count-cell {
              text-align: right;
          }
          .button-cell {
              border: none;
              padding-left: 10px;
          }
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
