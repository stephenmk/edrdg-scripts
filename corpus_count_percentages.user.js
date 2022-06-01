// ==UserScript==
// @name        edrdg N-gram Corpus Count Percentages
// @namespace   edrdg-scripts
// @version     1.2
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/cgi-bin/ngramlookup*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       GM_setClipboard
// @run-at      document-end
// ==/UserScript==
'use strict';


const WORD_COL = 0;
const COUNT_COL = 1;
const PERC_COL = 2;


function tableToText() {
	let includePercentages = false;

	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("INPUT");
		if (checkbox.checked) {
			includePercentages = true;
		}
	})

	const maxWordLength = calculateMaxLength(WORD_COL);
	const maxCountCellLength = calculateMaxLength(COUNT_COL);
	let text = document.querySelector("h2").innerText + "\n";

	document.querySelectorAll("tr").forEach(row => {
		const wordCell = row.cells[WORD_COL];
		const countCell = row.cells[COUNT_COL];
		const percCell = row.cells[PERC_COL];
		const checkbox = row.querySelector("INPUT");

		text += "| "
		text += wordCell.innerText.padEnd(maxWordLength, "　");
		text += " | "
		text += countCell.innerText.padStart(maxCountCellLength);
		text += " |"

		if (includePercentages && checkbox.checked) {
			text += percCell.innerText.padStart(6) + " |";
		} else if (includePercentages) {
			text += "  N/A  |";
		}

		text += "\n";
	})

	return text.substring(0, text.length - 1);;
}


function copyTableToClipboard() {
	const tableText = tableToText();
	GM_setClipboard(tableText);
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
		const checkbox = row.querySelector("INPUT");
		if (checkbox.checked) {
			const countCell = row.cells[COUNT_COL];
			totalCount += parseInt(countCell.dataset.count);
		}
	})
	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("INPUT");
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


function togglePercentages() {
	const firstCheckBox = document.querySelector("INPUT");
	const toggle = !firstCheckBox.checked;
	document.querySelectorAll("tr").forEach(row => {
		const checkbox = row.querySelector("INPUT");
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
		const checkBox = document.createElement("INPUT");
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

	const copyButton = document.createElement("button");
	copyButton.innerText = "Copy to Clipboard";
	copyButton.addEventListener('click', copyTableToClipboard);
	document.body.appendChild(copyButton);

	const style = document.createElement('style');
	style.innerText = `
          tr td:nth-child(3) {
            min-width: 60px;
          }`;
	document.head.appendChild(style);
}


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
