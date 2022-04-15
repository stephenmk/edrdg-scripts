// ==UserScript==
// @name        edrdg N-gram Corpus Count Percentages
// @namespace   edrdg-scripts
// @version     1.1
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/cgi-bin/ngramlookup*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// ==/UserScript==
'use strict';


function main() {
	// Calculate the total number of counts (for calculating percentages later).
	// Prepend formatted count text values to the beginning of the rows and
	// determine the maximum text length (for padding later).
	let totalCount = 0;
	let maxCountCellLength = 0;
	document.querySelectorAll("tr").forEach(row => {
		const cellCount = parseInt(row.cells[1].innerText);
		const displayCell = row.insertCell(0);

		if (!Number.isNaN(cellCount)) {
			totalCount += cellCount;
			displayCell.innerText = Number(cellCount).toLocaleString();
		} else {
			displayCell.innerText = "None";
		}

		if (maxCountCellLength < displayCell.innerText.length) {
			maxCountCellLength = displayCell.innerText.length;
		}
	})


	// Insert new cells into the table with percentage information.
	// Format the new count cells and delete the original cells.
	document.querySelectorAll("tr").forEach(row => {
		const cellCount = parseInt(row.cells[2].innerText);
		const percText = !Number.isNaN(cellCount) ?
			parseFloat(cellCount * 100.0 / totalCount).toFixed(1) + "%" :
			"-  ";

		// Pad percentages with spaces so they'll look nicer when copied & pasted elsewhere.
		const percCell = row.insertCell(1);
		percCell.innerText = percText.padStart(6);

		// Pad formatted counts with spaces.
		row.cells[0].innerText = row.cells[0].innerText.padStart(maxCountCellLength);

		// Delete the original count cells.
		row.deleteCell(3);
	})


	// Align the counts and percentages to the right.
	const style = document.createElement('style');
	style.innerHTML = `
          tr td:nth-child(-n+2) {
            white-space: pre;
            text-align: right;
            padding-right: 25px;
          }`;
	document.head.appendChild(style);
}


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
