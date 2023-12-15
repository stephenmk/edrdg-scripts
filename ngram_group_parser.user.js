// ==UserScript==
// @name        edrdg N-gram group parser
// @namespace   edrdg-scripts
// @version     2023.12.15.0
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/ngramcounts*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// @homepageURL https://github.com/stephenmk/edrdg-scripts
// @updateURL   https://github.com/stephenmk/edrdg-scripts/raw/main/ngram_group_parser.user.js
// ==/UserScript==
'use strict';


const omissibleBraces = "（）()［］[]";
const alternativeBraces = "〈〉＜＞<>｛｝{}";
const delimiters = "／,、.。;； ";


function partsToSearchTerms(parts) {
	let delimitedTerms = [];
	let terms = [""];
	for (const part of parts) {
		if (part.isDelimiter) {
			delimitedTerms = delimitedTerms.concat(terms);
			terms = [""];
		} else if (part.groupType === "omissible") {
			const partTerms = partsToSearchTerms(part);
			let newTerms = terms;
			for (const partTerm of partTerms) {
				newTerms = newTerms.concat(terms.map(term => term + partTerm));
			}
			terms = newTerms;
		} else if (part.groupType === "alternative") {
			const partTerms = partsToSearchTerms(part);
			let newTerms = [];
			for (const partTerm of partTerms) {
				newTerms = newTerms.concat(terms.map(term => term + partTerm));
			}
			terms = newTerms;
		} else {
			terms = terms.map(term => term + part);
		}
	}
	if (terms.length !== 1 || terms[0] !== "") {
		delimitedTerms = delimitedTerms.concat(terms);
	}
	return delimitedTerms;
}


function partsToNormalizedText(parts) {
	if (typeof parts === "string") {
		return parts;
	} else if (parts.isDelimiter) {
		return delimiters[0];
	}
	const subTexts = [];
	for (const part of parts) {
		subTexts.push(partsToNormalizedText(part));
	}
	let lBrace, rBrace;
	if (parts.groupType === "omissible") {
		lBrace = omissibleBraces[0];
		rBrace = omissibleBraces[1];
	} else if (parts.groupType === "alternative") {
		lBrace = alternativeBraces[0];
		rBrace = alternativeBraces[1];
	} else {
		lBrace = "";
		rBrace = "";
	}
	const subText = subTexts.join("");
	const text = `${lBrace}${subText}${rBrace}`;
	return text;
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
	const countCell = document.createElement("td");
	countCell.innerText = partsToSearchTerms(parts).length;
	countCell.classList.add("count-cell");

	const expCell = document.createElement("td");
	expCell.innerText = partsToNormalizedText(parts);

	const copyButton = document.createElement("button");
	copyButton.type = "button";
	copyButton.innerText = "Copy";
	copyButton.addEventListener('click', copyGroupText);
	const copyCell = document.createElement("td");
	copyCell.appendChild(copyButton);
	copyCell.classList.add("button-cell");

	const table = groupTable();
	const row = table.insertRow();
	row.append(countCell, expCell, copyCell);
}


function copyGroupText(e) {
	const tableRow = e.target.parentElement.parentElement;
	const text = tableRow.cells[1].innerText;
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(text);
	}
}


function pushAtDepth(parts, part, depth) {
	if (depth > 0) {
		pushAtDepth(parts[parts.length - 1], part, depth - 1);
	} else if (Array.isArray(part)) {
		parts.push(part);
	} else if (part.isDelimiter) {
		parts.push(part);
		parts.push("");
	} else if (part.isContinuation) {
		parts.push("");
	} else {
		parts[parts.length - 1] += part;
	}
}


function textContainsBraces(text, braces) {
	for (const character of text) {
		if (braces.indexOf(character) !== -1) {
			return true;
		}
	}
	return false;
}


function parseGroups(text) {
	const braces = omissibleBraces + alternativeBraces;
	if (!textContainsBraces(text, braces)) {
		return null;
	}
	const delimiterPart = {
		isDelimiter: true
	};
	const continuationPart = {
		isContinuation: true
	};
	const braceStack = [];
	const parts = [""];
	for (const character of text) {
		const bracePosition = braces.indexOf(character);
		if (bracePosition === -1) {
			// inside or outside braces
			if (delimiters.indexOf(character) === -1) {
				pushAtDepth(parts, character, braceStack.length)
			} else {
				pushAtDepth(parts, delimiterPart, braceStack.length)
			}
		} else if (bracePosition % 2 === 0) {
			// open brace
			const part = [""];
			if (omissibleBraces.indexOf(character) === -1) {
				part.groupType = "alternative";
			} else {
				part.groupType = "omissible";
			}
			pushAtDepth(parts, part, braceStack.length);
			braceStack.push(bracePosition + 1);
		} else if (braceStack.pop() !== bracePosition) {
			// failure: unbalanced braces
			return null;
		} else {
			// close brace
			pushAtDepth(parts, continuationPart, braceStack.length);
		}
	}
	if (braceStack.length === 0) {
		return parts
	} else {
		// failure: unbalanced braces
		return null;
	}
}


function parseGroupListener() {
	const textBox = document.querySelector("input");
	const text = textBox.value;
	const parts = parseGroups(text);
	if (parts === null) {
		return;
	}
	const terms = partsToSearchTerms(parts);
	textBox.value = terms.join("；");
	console.log(parts);
	insertIntoTable(parts);
}


function main() {
	const parseButton = document.createElement("button");
	parseButton.type = "button";
	parseButton.innerText = "Expand Groups";
	parseButton.addEventListener('click', parseGroupListener);

	const breaks = document.querySelectorAll("br");
	const finalBreak = breaks[breaks.length - 1];
	finalBreak.before(" ");
	finalBreak.before(parseButton);

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


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
