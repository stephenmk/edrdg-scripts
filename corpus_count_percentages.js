// ==UserScript==
// @name        edrdg N-gram Corpus Count Percentages
// @namespace   edrdg-scripts
// @version     1.0
// @author      Stephen Kraus
// @match       *://*.edrdg.org/~jwb/cgi-bin/ngramlookup*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// ==/UserScript==
'use strict';


function main() {
	// Calculate the total number of counts (for calculating percentages later).
	// Determine the maximum text length (for padding and formatting later).
	let totalCount = 0;
	let maxCountCellLength = 0;
	document.querySelectorAll("tr td:nth-child(2)").forEach(cell => {
		const cellCount = parseInt(cell.innerText);
		totalCount += !Number.isNaN(cellCount) ? cellCount : 0;
		if (maxCountCellLength < cell.innerText.length) {
			maxCountCellLength = cell.innerText.length;
		}
	})


	// Prepend new cells to the table with percentage information.
	document.querySelectorAll("tr").forEach(row => {
		const cellCount = parseInt(row.cells[1].innerText);
		const percText = !Number.isNaN(cellCount) ?
			parseFloat(cellCount * 100.0 / totalCount).toFixed(1) + "%" :
			"-  ";
		// Pad with spaces so this info will look nicer when copied & pasted elsewhere.
		const percTextNode = document.createTextNode(percText.padStart(6));
		const percCell = row.insertCell(0);
		percCell.appendChild(percTextNode);
	})


	// Move the count cells to the beginning of the rows.
	document.querySelectorAll("tr").forEach(row => {
		const countNodeCopy = document.createTextNode(row.cells[2].innerText.padStart(maxCountCellLength));
		const newCountCell = row.insertCell(0);
		newCountCell.appendChild(countNodeCopy);
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
