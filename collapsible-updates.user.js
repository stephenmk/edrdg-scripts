// ==UserScript==
// @name        JMdictDB sort updates by time
// @namespace   edrdg-scripts
// @version     1.0
// @author      Stephen Kraus
// @match       *://*.edrdg.org/jmdictdb/cgi-bin/updates.py*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// ==/UserScript==
'use strict';


const localeOptions = {
	year: "numeric",
	month: "numeric",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h12",
};

const timestampRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;


class EntryGroup {
	constructor(entry) {
		this.entries = [entry];
		this.maxDate = entry.date;
	}
	push(entry) {
		this.entries.push(entry);
		if (this.maxDate < entry.date) {
			this.maxDate = entry.date;
		}
	}
	sort() {
		this.entries.sort((a, b) => b.date - a.date);
	}
}


class Entry {
	constructor(item) {
		this.item = item;
	}
	get mostRecentHistoryHeader() {
		const hhdr = this.item.querySelector(".hhdr");
		return new HistoryHeader(hhdr);
	}
	get historyHeaders() {
		const historyHeaders = [];
		this.item.querySelectorAll(".hhdr").forEach(hhdr => {
			historyHeaders.push(new HistoryHeader(hhdr));
		});
		return historyHeaders;
	}
	get sequence() {
		if ("sequence" in this.item.dataset) {
			return this.item.dataset.sequence;
		}
		const sequence = this.item.querySelector("a").innerText;
		this.item.dataset.sequence = sequence;
		return sequence;
	}
	get corpus() {
		if ("corpus" in this.item.dataset) {
			return this.item.dataset.corpus;
		}
		const corpus = this.item.innerText.match(/\w+\b/)[0];
		this.item.dataset.corpus = corpus;
		return corpus;
	}
	get status() {
		if ("status" in this.item.dataset) {
			return this.item.dataset.status;
		}
		const status = this.item.querySelector(".status").innerText.trim();
		this.item.dataset.status = status;
		return status;
	}
	get expression() {
		if ("expression" in this.item.dataset) {
			return this.item.dataset.expression;
		}
		const expression = this.item.querySelector(".kanj") === null ?
			this.item.querySelector(".rdng").innerText :
			this.item.querySelector(".kanj").innerText;
		this.item.dataset.expression = expression;
		return expression;
	}
	get date() {
		if ("date" in this.item.dataset) {
			return new Date(this.item.dataset.date);
		}
		const date = this.mostRecentHistoryHeader.date;
		this.item.dataset.date = date.toJSON();
		return date;
	}
	get recentSubmitters() {
		if ("recentSubmitters" in this.item.dataset) {
			return JSON.parse(this.item.dataset.recentSubmitters);
		}
		const oneWeekFromLastEdit = (() => {
			const x = this.date;
			x.setDate(x.getDate() - 7);
			return x;
		})();
		const submitters = [];
		this.historyHeaders.forEach(historyHeader => {
			const editDate = historyHeader.date;
			const submitter = historyHeader.submitter;
			if (oneWeekFromLastEdit < editDate) {
				submitters.push(submitter);
			}
		});
		const uniqueSubmitters = [...(new Set(submitters))];
		uniqueSubmitters.reverse();
		this.item.dataset.recentSubmitters = JSON.stringify(uniqueSubmitters);
		return uniqueSubmitters;
	}
	convertHistoryDatesToCurrentLocale() {
		this.historyHeaders.forEach(historyHeader => {
			historyHeader.convertDateToCurrentLocale();
		});
	}
}


class HistoryHeader {
	constructor(hhdr) {
		this.hhdr = hhdr;
	}
	get date() {
		if ("date" in this.hhdr.dataset) {
			return new Date(this.hhdr.dataset.date);
		}
		const timestamps = this.hhdr.innerText.match(timestampRegex);
		if (timestamps === null) {
			timestamps = ["1970-01-01 00:00:00"];
		}
		const date = new Date(timestamps[0].replace(/-/g, "/") + " +0000");
		this.hhdr.dataset.date = date.toJSON();
		return date;
	}
	get submitter() {
		if ("submitter" in this.hhdr.dataset) {
			return this.hhdr.dataset.submitter;
		}
		const submitterText = this.hhdr.querySelector(".submitter_name").innerText;
		const submitter = submitterText == "" ?
			"Anonymous" :
			submitterText;
		this.hhdr.dataset.submitter = submitter;
		return submitter;
	}
	convertDateToCurrentLocale() {
		const date = this.date;
		const childTextNodes = Array.from(this.hhdr.childNodes)
			.filter(n => n.nodeType == Node.TEXT_NODE);
		childTextNodes.forEach(node => {
			if (timestampRegex.test(node.textContent)) {
				const dateLocaleString = date.toLocaleString(undefined, localeOptions);
				const newTextContent = node.textContent.replace(timestampRegex, dateLocaleString);
				node.textContent = newTextContent;
			}
		});
	}
}


function makeStyleClasses() {
	const style = document.createElement('style');
	style.innerText = `
           .item {
             margin: 0px !important;
             padding: 10px 10px 10px 20px !important;
             border-top-width: 0px !important;
             border-radius: 0px 0px 10px 10px;
           }
           .jmd-footer {
             height: 90vh; /* prevent the scroll from jumping around when collapsing content near the bottom of the page */
           }
           .collapse-button {
             cursor: pointer;
             padding: 5px 0px 5px 50px;
             margin: 2px 0px 0px 0px;
             width: 100%;
             text-align: left;
             border: solid thin black;
             border-radius: 10px;
             font-size: 1em;
             scroll-margin-top: 50px;
           }
           .collapse-button.active {
             border-radius: 10px 10px 0px 0px;
           }
           .collapse-content {
             display: block;
             overflow: hidden;
           }
           .cc-hidden {
             display: none;
             max-height: 0;
           }
           .cc-transition.cc-hidden {
             display: block;
           }
           .cc-transition {
             transition: max-height 0.5s ease;
           }
           `;
	document.head.appendChild(style);
}


function convertDatesToCurrentLocale() {
	document.querySelectorAll(".item").forEach(item => {
		const entry = new Entry(item);
		entry.convertHistoryDatesToCurrentLocale();
	});
}


function sortEntries() {
	const entries = [];

	document.querySelectorAll(".item").forEach(item => {
		entries.push(new Entry(item));
	});

	const seqToGroups = entries.reduce((seqToGroups, entry) => {
		const sequence = entry.sequence;
		if (!seqToGroups[sequence]) {
			seqToGroups[sequence] = new EntryGroup(entry);
		} else {
			seqToGroups[sequence].push(entry)
		}
		return seqToGroups;
	}, {});

	const jmdContent = document.querySelector(".jmd-content");

	const entryGroups = Object.values(seqToGroups);
	entryGroups.sort((a, b) => b.maxDate - a.maxDate);

	entryGroups.forEach(entryGroup => {
		entryGroup.sort();
		entryGroup.entries.forEach(entry => {
			jmdContent.appendChild(entry.item);
		});
	});
}


function addCollapseButtons() {
	const buttonClickListener = function() {
		const button = this;
		const content = this.nextElementSibling;
		button.classList.add("active");
		content.classList.add("cc-transition");
		if (content.classList.contains("cc-hidden")) {
			content.style.maxHeight = content.scrollHeight + "px";
			content.classList.remove("cc-hidden");
		} else {
			content.style.maxHeight = 0;
			content.classList.add("cc-hidden");
		}
	}

	const contentTransitionEndListener = function() {
		const content = this;
		const button = this.previousElementSibling;
		content.classList.remove('cc-transition');
		if (content.classList.contains("cc-hidden")) {
			button.classList.remove("active");
		} else {
			//button.scrollIntoView({ behavior: "smooth" });
		}
	}

	const createJapaneseTextNode = function(text) {
		const span = document.createElement("span");
		span.lang = "ja";
		span.textContent = text;
		return span;
	}

	document.querySelectorAll(".item").forEach(item => {
		const entry = new Entry(item);
		const collapseButton = document.createElement("button");

		item.classList.add("collapse-content");
		item.classList.add("cc-hidden")
		collapseButton.classList.add("collapse-button");

		const childNodes = [
			document.createTextNode(entry.corpus),
			document.createTextNode(" "),
			document.createTextNode(entry.sequence),
			document.createTextNode(" "),
			createJapaneseTextNode("【" + entry.expression + "】"),
			document.createTextNode(" "),
			document.createTextNode(entry.status),
			document.createElement("br"),
			document.createTextNode(entry.date.toLocaleString(undefined, localeOptions)),
			document.createTextNode(" - "),
			document.createTextNode(entry.recentSubmitters.join(", ")),
		];

		childNodes.forEach(node => {
			collapseButton.appendChild(node);
		});

		collapseButton.addEventListener("click", buttonClickListener, false);
		item.addEventListener("transitionend", contentTransitionEndListener, false);
		item.before(collapseButton);
	});
}


function main() {
	if (document.querySelectorAll(".rdng").length == 0) {
		return;
	}
	makeStyleClasses();
	convertDatesToCurrentLocale();
	sortEntries();
	addCollapseButtons();
}


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
