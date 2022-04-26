// ==UserScript==
// @name           JMdictDB collapsible updates
// @namespace      edrdg-scripts
// @version        1.0
// @author         Stephen Kraus
// @match          *://*.edrdg.org/jmdictdb/cgi-bin/updates.py*
// @exclude-match  *://*.edrdg.org/jmdictdb/cgi-bin/updates.py*&i=*
// @icon           https://www.edrdg.org/favicon.ico
// @grant          none
// @run-at         document-end
// ==/UserScript==
'use strict';


const localeOptions = {
	year: "2-digit",
	month: "numeric",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h12",
};


class EntryTree {
	#graph; // parent ID -> array of children IDs
	constructor() {
		this.entries = [];
		this.#graph = {};
	}
	add(entry) {
		if (this.entries.find(e => e.id === entry.id)) {
			console.warn("Attempted to add duplicate Entry to EntryTree", entry);
			return;
		}
		this.entries.push(entry);
		if (entry.id in this.#graph === false)
			this.#graph[entry.id] = [];
		if (entry.parentId === null)
			return;
		if (entry.parentId in this.#graph === false)
			this.#graph[entry.parentId] = [];
		if (this.#graph[entry.parentId].includes(entry.id) === false)
			this.#graph[entry.parentId].push(entry.id);
	}
	branches() {
		const branches = [];
		this.#childlessEntries().forEach(child => {
			const branch = [child];
			this.#ancestorEntries(child).forEach(ancestor => {
				branch.push(ancestor);
			})
			branches.push(branch);
		});
		return branches;
	}
	#childlessEntries() {
		const children = this.entries.filter(entry =>
			this.#graph[entry.id].length === 0
		);
		children.sort((a, b) => {
			if (a.date === b.date)
				return b.id - a.id;
			else
				return b.date - a.date;
		});
		return children;
	}
	#ancestorEntries(entry) {
		const ancestors = [];
		let parentId = entry.parentId;
		while (parentId !== null && !ancestors.find(e => e.id === parentId)) {
			const parent = this.entries.find(e => e.id === parentId);
			if (parent === undefined) {
				// todo: fetch entry from web / cache?
				parentId = null;
			} else {
				parentId = parent.parentId;
				ancestors.push(parent);
			}
		}
		return ancestors;
	}
}


class Entry {
	#item;
	#id;
	#parentId;
	#sequence;
	#corpus;
	#status;
	#expression;
	#date;
	#recentSubmitters;
	#historyHeaders;
	constructor(item) {
		this.#item = item;
	}
	get id() {
		if (this.#id !== undefined) {
			return this.#id;
		}
		const parsedId = parseInt(this.#item.querySelector(".pkid a").innerText);
		if (Number.isNaN(parsedId)) {
			console.error("ID not found in Entry", this.#item);
			throw new Error("Fatal error");
		}
		const id = Number.isNaN(parsedId) ? 0 : parsedId;
		this.#id = id;
		return id;
	}
	get parentId() {
		if (this.#parentId !== undefined) {
			return this.#parentId;
		}
		const parsedParentId = parseInt(this.#item.querySelector(".status a")?.innerText);
		const parentId = Number.isNaN(parsedParentId) ? null : parsedParentId;
		this.#parentId = parentId;
		return parentId;
	}
	get sequence() {
		if (this.#sequence !== undefined) {
			return this.#sequence;
		}
		const parsedSeq = parseInt(this.#item.querySelector("a").innerText);
		const sequence = Number.isNaN(parsedSeq) ? 0 : parsedSeq;
		this.#sequence = sequence;
		return sequence;
	}
	get corpus() {
		if (this.#corpus !== undefined) {
			return this.#corpus;
		}
		const corpus = this.#item.innerText.match(/\w+\b/)[0];
		this.#corpus = corpus;
		return corpus;
	}
	get status() {
		if (this.#status !== undefined) {
			return this.#status;
		}
		const status = this.#item.querySelector(".status .pend") ?
			this.#item.querySelector(".status .pend").innerText :
			this.#item.querySelector(".status").innerText;
		this.#status = status;
		return status;
	}
	get expression() {
		if (this.#expression !== undefined) {
			return this.#expression;
		}
		const expression = this.#item.querySelector(".kanj") === null ?
			this.#item.querySelector(".rdng").innerText :
			this.#item.querySelector(".kanj").innerText;
		this.#expression = expression;
		return expression;
	}
	get date() {
		if (this.#date !== undefined) {
			return this.#date;
		}
		const date = this.historyHeaders[0].date;
		this.#date = date;
		return date;
	}
	get recentSubmitters() {
		if (this.#recentSubmitters !== undefined) {
			return this.#recentSubmitters;
		}
		const oneWeekFromLastEdit = (() => {
			const x = new Date(this.date);
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
		this.#recentSubmitters = uniqueSubmitters;
		return uniqueSubmitters;
	}
	get historyHeaders() {
		if (this.#historyHeaders !== undefined) {
			return this.#historyHeaders;
		}
		const historyHeaders = [];
		this.#item.querySelectorAll(".hhdr").forEach(hhdr => {
			historyHeaders.push(new HistoryHeader(hhdr));
		});
		this.#historyHeaders = historyHeaders;
		return historyHeaders;
	}
	/* Should this instead be done during the createContentNode procedure? */
	convertHistoryDatesToCurrentLocale() {
		this.historyHeaders.forEach(historyHeader => {
			historyHeader.convertDateToCurrentLocale();
		});
	}
	createSummaryNode() {
		const childNodes = [
			document.createTextNode("#"),
			document.createTextNode(this.sequence),
			document.createTextNode(" "),
			this.#createJapaneseTextNode("【" + this.expression + "】"),
			document.createTextNode(" "),
			document.createTextNode(this.status),
			document.createElement("br"),
			document.createTextNode(this.date.toLocaleString(undefined, localeOptions)),
			document.createTextNode(" - "),
			document.createTextNode(this.recentSubmitters.join(", ")),
		];
		const summaryNode = document.createElement("div");
		childNodes.forEach(node => {
			summaryNode.appendChild(node);
		});
		return summaryNode;
	}
	createContentNode() {
		const contentNode = this.#item.cloneNode(true);
		return contentNode;
	}
	#createJapaneseTextNode(text) {
		const span = document.createElement("span");
		span.lang = "ja";
		span.textContent = text;
		return span;
	}
}


class HistoryHeader {
	static #timestampRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
	#hhdr;
	#date;
	#submitter;
	constructor(hhdr) {
		this.#hhdr = hhdr;
	}
	get date() {
		if (this.#date !== undefined) {
			return this.#date;
		}
		const timestamps = this.#hhdr.innerText.match(HistoryHeader.#timestampRegex);
		if (timestamps === null) {
			timestamps = ["1970-01-01 00:00:00"];
		}
		const date = new Date(timestamps[0].replace(/-/g, "/") + " +0000");
		this.#hhdr.dataset.date = date.toJSON();
		this.#date = date;
		return date;
	}
	get submitter() {
		if (this.#submitter !== undefined) {
			return this.#submitter;
		}
		const submitterText = this.#hhdr.querySelector(".submitter_name").innerText;
		const submitter = submitterText == "" ?
			"Anonymous" :
			submitterText;
		this.#submitter = submitter;
		return submitter;
	}
	convertDateToCurrentLocale() {
		const childTextNodes = Array.from(this.#hhdr.childNodes)
			.filter(n => n.nodeType == Node.TEXT_NODE);
		childTextNodes.forEach(node => {
			if (HistoryHeader.#timestampRegex.test(node.textContent)) {
				const dateLocaleString = this.date.toLocaleString(undefined, localeOptions);
				const newTextContent = node.textContent.replace(HistoryHeader.#timestampRegex, dateLocaleString);
				node.textContent = newTextContent;
			}
		});
	}
}


class CollapsibleContent {
	createNode(headerNode, contentNode) {
		const collapseButton = document.createElement("button");
		collapseButton.classList.add("collapse-button");
		collapseButton.addEventListener("click", this.#buttonClickListener);
		collapseButton.appendChild(headerNode);

		const collapseContent = document.createElement("div");
		collapseContent.classList.add("collapse-content");
		collapseContent.classList.add("cc-hidden");
		collapseContent.addEventListener("transitionend", this.#contentTransitionEndListener);
		collapseContent.appendChild(contentNode);

		const collapseContainer = document.createElement("div");
		collapseContainer.classList.add("collapse-container");
		collapseContainer.appendChild(collapseButton);
		collapseContainer.appendChild(collapseContent);

		return collapseContainer;
	}
	#buttonClickListener() {
		const button = this;
		const content = this.nextElementSibling;
		button.classList.add("active");
		content.classList.add("cc-transition");
		content.style.transitionDuration = (content.scrollHeight / 2000) + "s";
		if (content.classList.contains("cc-hidden")) {
			content.style.maxHeight = CollapsibleContent.getMaxScrollHeight(content) + "px";
			content.classList.remove("cc-hidden");
		} else {
			content.style.maxHeight = 0;
			content.classList.add("cc-hidden");
		}
	}
	#contentTransitionEndListener() {
		const button = this.previousElementSibling;
		const content = this;
		content.classList.remove('cc-transition');
		if (content.classList.contains("cc-hidden")) {
			button.classList.remove("active");
		}
	}
	static getMaxScrollHeight(content) {
		const walkNodeTree = function(node, f) {
			node.childNodes.forEach(node => {
				f(node);
				walkNodeTree(node, f);
			})
		}
		const showNode = function(node) {
			if (node.style?.display === "none") {
				node.style.display = "";
				node.dataset.hideMe = true;
			}
		}
		const hideNode = function(node) {
			if (node.dataset?.hideMe) {
				node.style.display = "none";
				delete node.dataset.hideMe;
			}
		}
		walkNodeTree(content, showNode);
		const scrollHeight = content.scrollHeight;
		walkNodeTree(content, hideNode);
		return scrollHeight;
	}
}


function createStyleNode() {
	const styleNode = document.createElement('style');
	styleNode.innerText = `
           .item {
             margin: 0px !important;
             padding: 10px 10px 10px 20px !important;
             border: 0px 1px 1px 1px !important;
             border-top-width: 0px !important;
             border-radius: 0px 0px 10px 10px;
           }
           .jmd-footer {
             height: 90vh; /* prevent the scroll from jumping around when collapsing content near the bottom of the page */
           }
           .indent {
             margin-left: calc(3vw * var(--indent));
           }
           .collapse-button {
             cursor: pointer;
             padding: 5px 0px 5px 50px;
             margin: 2px 0px 0px 0px;
             width: 100%;
             text-align: left;
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
             transition: max-height ease;
           }
           `;
	return styleNode;
}


function createIndentNode(childNode, indent) {
	const indentNode = document.createElement("div");
	indentNode.classList.add("indent");
	indentNode.style = "--indent: " + indent;
	indentNode.appendChild(childNode);
	return indentNode;
}


function main() {
	const styleNode = createStyleNode();
	document.head.appendChild(styleNode);

	const entryTree = new EntryTree();

	document.querySelectorAll(".item").forEach(item => {
		const entry = new Entry(item);
		entryTree.add(entry);
		item.remove();
	});

	entryTree.entries.forEach(entry => {
		entry.convertHistoryDatesToCurrentLocale();
	})

	const cc = new CollapsibleContent();
	const documentBodyContent = document.querySelector(".jmd-content");

	entryTree.branches().forEach(entryBranch => {
		entryBranch.forEach((entry, index) => {
			const collapsibleEntryNode = cc.createNode(entry.createSummaryNode(), entry.createContentNode())
			const indentedNode = createIndentNode(collapsibleEntryNode, index)
			documentBodyContent.appendChild(indentedNode);
		})
	});
}


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
