// ==UserScript==
// @name        edrdg N-gram Corpus Count Percentages
// @namespace   edrdg-scripts
// @version     2023.02.22.0
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/cgi-bin/ngramlookup*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// @homepageURL https://github.com/stephenmk/edrdg-scripts
// @updateURL   https://github.com/stephenmk/edrdg-scripts/raw/main/corpus_count_percentages.user.js
// ==/UserScript==
'use strict';

const WORD_COL = 0;
const COUNT_COL = 1;
const PERC_COL = 2;

const TOP_JUNCTIONS = ["╭", "┬", "╮"];
const MID_JUNCTIONS = ["├", "┼", "┤"];
const BOT_JUNCTIONS = ["╰", "┴", "╯"];


function makeTableBorder(maxWordLength, maxCountCellLength, includePercentages, junctions) {
	let text = "";
	text += junctions[0] + "─";
	text += "".padEnd(maxWordLength, "ー");
	text += "─" + junctions[1] + "─";
	text += "".padStart(maxCountCellLength, "─");

	if (includePercentages) {
		text += "─" + junctions[1];
		text += "".padStart(6, "─");
	}
	text += "─" + junctions[2];
	return text;
}


function tableToText() {
	let includePercentages = false;

	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("input");
		if (checkbox.checked) {
			includePercentages = true;
		}
	})

	const maxWordLength = calculateMaxLength(WORD_COL);
	const maxCountCellLength = calculateMaxLength(COUNT_COL);
	let text = document.querySelector("h2").innerText + "\n";
	text += makeTableBorder(maxWordLength, maxCountCellLength, includePercentages, TOP_JUNCTIONS);
	text += "\n";

	document.querySelectorAll("tr").forEach(row => {
		const wordCell = row.cells[WORD_COL];
		const countCell = row.cells[COUNT_COL];
		const percCell = row.cells[PERC_COL];
		const checkbox = row.querySelector("input");

		text += "│ ";
		text += wordCell.innerText.padEnd(maxWordLength, "　");
		text += " │ ";
		text += countCell.innerText.padStart(maxCountCellLength);
		text += " │";

		if (includePercentages && checkbox.checked) {
			text += percCell.innerText.padStart(6) + " │";
		} else if (includePercentages) {
			text += "  N/A  │";
		}

		text += "\n";
	})

	const partialTableCheckBox = document.querySelector("#partialTableCheckbox");
	if (partialTableCheckBox.checked) {
		text += makeTableBorder(maxWordLength, maxCountCellLength, includePercentages, MID_JUNCTIONS);
	} else {
		text += makeTableBorder(maxWordLength, maxCountCellLength, includePercentages, BOT_JUNCTIONS);
	}

	return text;
}


function copyTableToClipboard() {
	const tableText = tableToText();
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(tableText);
	}
}


function calculateMaxLength(column) {
	let maxLength = 0;
	document.querySelectorAll("tr").forEach(row => {
		const cell = row.cells[column];
		const length = cell.innerText.length;
		if (maxLength < length) {
			maxLength = length;
		}
	})
	return maxLength;
}


function displayPercentages() {
	let totalCount = 0;
	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("input");
		if (checkbox.checked) {
			const countCell = row.cells[COUNT_COL];
			totalCount += parseInt(countCell.dataset.count);
		}
	})
	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("input");
		const countCell = row.cells[COUNT_COL];
		const percCell = row.cells[PERC_COL];
		if (checkbox.checked) {
			const cellCount = parseInt(countCell.dataset.count);
			const percText = parseFloat(cellCount * 100.0 / totalCount).toFixed(1) + "%";
			percCell.innerText = percText;
		} else {
			percCell.innerText = "";
		}
	})
}


function isKana(text) {
	for (const character of text) {
		if (character < "ぁ" || character > "ヿ") {
			return false;
		}
	}
	return true;
}


function sortTable() {
	const table = document.querySelector("table");
	const rows = table.rows;
	Array.from(rows)
		.sort((a, b) => {
			const a_is_kana = isKana(a.cells[WORD_COL].innerText);
			const b_is_kana = isKana(b.cells[WORD_COL].innerText);
			const a_count = a.cells[COUNT_COL].dataset.count;
			const b_count = b.cells[COUNT_COL].dataset.count;
			if (a_is_kana === b_is_kana) {
				return b_count - a_count;
			} else if (a_is_kana) {
				return 1;
			} else {
				return -1;
			}
		})
		.forEach(tr => table.tBodies[0].appendChild(tr));
}


function togglePercentages() {
	const firstCheckBox = document.querySelector("input");
	const toggle = !firstCheckBox.checked;
	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("input");
		checkbox.checked = toggle;
	})
	displayPercentages();
}


function formatCounts() {
	document.querySelectorAll("tr").forEach(row => {
		const countCell = row.cells[COUNT_COL];
		const cellCount = parseInt(countCell.innerText);
		if (!Number.isNaN(cellCount)) {
			countCell.dataset.count = cellCount;
			countCell.innerText = Number(cellCount).toLocaleString();
		} else {
			countCell.dataset.count = 0;
			countCell.innerText = "0";
		}
	})
}


function main() {
	formatCounts();

	document.querySelectorAll("tr").forEach(row => {
		while (row.cells.length < 3) {
			const newCell = row.insertCell();
			newCell.align = "right";
		}
		row.cells[2].align = "right"; // for the "Top 10 N-grams Lookup" page
		const checkBox = document.createElement("input");
		checkBox.setAttribute("type", "checkbox");
		checkBox.checked = true;
		checkBox.addEventListener('change', displayPercentages);
		const checkboxCell = row.insertCell();
		checkboxCell.appendChild(checkBox);
	})
	displayPercentages();

	const toggleButton = document.createElement("button");
	toggleButton.innerText = "Toggle Percentages";
	toggleButton.addEventListener('click', togglePercentages);
	document.body.appendChild(toggleButton);

	const sortButton = document.createElement("button");
	sortButton.innerText = "Sort Table";
	sortButton.addEventListener('click', sortTable);
	document.body.appendChild(sortButton);

	const copyButton = document.createElement("button");
	copyButton.innerText = "Copy to Clipboard";
	copyButton.addEventListener('click', copyTableToClipboard);
	document.body.appendChild(copyButton);

	const checkBox = document.createElement("input");
	checkBox.setAttribute("type", "checkbox");
	checkBox.checked = false;
	checkBox.innerText = "Partial"
	checkBox.id = "partialTableCheckbox"
	document.body.appendChild(checkBox);

	const checkBoxLabel = document.createElement("label");
	checkBoxLabel.setAttribute("for", "partialTableCheckbox");
	checkBoxLabel.innerText = "Partial Table"
	document.body.appendChild(checkBoxLabel);

	const style = document.createElement('style');
	style.innerText = `
          tr td:nth-child(3) {
            min-width: 60px;
          }`;
	document.head.appendChild(style);
}


main();
