// ==UserScript==
// @name           JMdictDB collapsible updates
// @namespace      edrdg-scripts
// @version        2023.12.15.0
// @author         Stephen Kraus
// @match          *://*.edrdg.org/jmwsgi/updates.py*
// @exclude-match  *://*.edrdg.org/jmwsgi/updates.py*&i=*
// @icon           https://www.edrdg.org/favicon.ico
// @grant          none
// @run-at         document-end
// @homepageURL    https://github.com/stephenmk/edrdg-scripts
// @updateURL      https://github.com/stephenmk/edrdg-scripts/raw/main/jmdictdb_collapsible_updates.user.js
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
		if (!Number.isInteger(entry.id)) {
			console.error("Entry must contain an integer ID", entry);
			return;
		}
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
				parentId = null;
			} else {
				parentId = parent.parentId;
				parent.isViewed = true;
				ancestors.push(parent);
			}
		}
		return ancestors;
	}
}


class Entry {
	#item;
	#isViewed;
	constructor(item) {
		this.#item = item;
		this.id = this.#getId(item);
		this.parentId = this.#getParentId(item);
		this.sequence = this.#getSequence(item);
		this.corpus = this.#getCorpus(item);
		this.status = this.#getStatus(item);
		this.expression = this.#getExpression(item);
		const historyHeaders = this.#getHistoryHeaders(item);
		this.statusCode = historyHeaders[0].statusCode;
		this.isPending = historyHeaders[0].isPending;
		this.date = historyHeaders[0].date;
		this.recentSubmitters = this.#getRecentSubmitters(historyHeaders);
	}
	#getId(item) {
		const parsedId = parseInt(item.querySelector(".pkid a").innerText);
		const id = Number.isNaN(parsedId) ? null : parsedId;
		return id;
	}
	#getParentId(item) {
		const parsedParentId = parseInt(item.querySelector(".status a")?.innerText);
		const parentId = Number.isNaN(parsedParentId) ? null : parsedParentId;
		return parentId;
	}
	#getSequence(item) {
		const parsedSeq = parseInt(item.querySelector("a").innerText);
		const sequence = Number.isNaN(parsedSeq) ? 0 : parsedSeq;
		return sequence;
	}
	#getCorpus(item) {
		const corpus = item.innerText.match(/\w+\b/)[0];
		return corpus;
	}
	#getStatus(item) {
		const status = item.querySelector(".status .pend") ?
			item.querySelector(".status .pend").innerText :
			item.querySelector(".status").innerText;
		return status;
	}
	#getExpression(item) {
		const expression = item.querySelector(".kanj") === null ?
			item.querySelector(".rdng").innerText :
			item.querySelector(".kanj").innerText;
		return expression;
	}
	#getHistoryHeaders(item) {
		const historyHeaders = [];
		item.querySelectorAll(".hhdr").forEach(hhdr => {
			historyHeaders.push(new HistoryHeader(hhdr));
		});
		return historyHeaders;
	}
	#getRecentSubmitters(historyHeaders) {
		const twoWeeksFromLastEdit = (() => {
			const x = new Date(this.date);
			x.setDate(x.getDate() - 14);
			return x;
		})();
		const submitterSet = new Set();
		historyHeaders.forEach(historyHeader => {
			const editDate = historyHeader.date;
			const submitter = historyHeader.submitter;
			if (twoWeeksFromLastEdit < editDate)
				submitterSet.add(submitter);
		});
		const submitters = [...submitterSet];
		submitters.reverse();
		return submitters;
	}
	get item() {
		const item = this.#item.cloneNode(true);
		return item;
	}
	get isViewed() {
		if (this.#isViewed !== undefined)
			return this.#isViewed;
		const viewedStorage = localStorage.getItem("jmdictdb-viewed-entries");
		if (viewedStorage === null)
			return false;
		const viewedSequences = JSON.parse(viewedStorage);
		if (this.sequence in viewedSequences === false)
			return false;
		const viewedIDs = viewedSequences[this.sequence];
		if (this.id in viewedIDs === false)
			return false;
		this.#isViewed = viewedIDs[this.id];
		return this.#isViewed;
	}
	set isViewed(value) {
		this.#isViewed = value;
		const viewedStorage = localStorage.getItem("jmdictdb-viewed-entries");
		const viewedSequences = viewedStorage !== null ? JSON.parse(viewedStorage) : {};
		if (this.sequence in viewedSequences === false)
			viewedSequences[this.sequence] = {};
		viewedSequences[this.sequence][this.id] = value;
		localStorage.setItem("jmdictdb-viewed-entries", JSON.stringify(viewedSequences));
	}
}


class HistoryHeader {
	static #timestampRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
	static #nullDate = new Date("1970/01/01 00:00:00 +0000");
	constructor(hhdr) {
		this.statusCode = this.#getStatusCode(hhdr);
		this.isPending = this.#getIsPending(hhdr);
		this.date = this.#getDate(hhdr);
		this.submitter = this.#getSubmitter(hhdr);
		this.#convertDateToCurrentLocale(hhdr);
	}
	#getStatusCode(hhdr) {
		const statusCode = hhdr.innerText.match(/^\s*([ADR])/);
		return statusCode[1];
	}
	#getIsPending(hhdr) {
		const isPending = /^\s*[ADR]\*/.test(hhdr.innerText);
		return isPending;
	}
	#getDate(hhdr) {
		const timestamps = hhdr.innerText.match(HistoryHeader.#timestampRegex);
		const date = timestamps === null ?
			new Date(HistoryHeader.#nullDate) :
			new Date(timestamps[0].replace(/-/g, "/") + " +0000");
		hhdr.dataset.date = date.toJSON();
		return date;
	}
	#getSubmitter(hhdr) {
		const submitterText = hhdr.querySelector(".submitter_name").innerText;
		const submitter = submitterText == "" ?
			"Anonymous" :
			submitterText;
		return submitter;
	}
	#convertDateToCurrentLocale(hhdr) {
		if (this.date.getTime() === HistoryHeader.#nullDate.getTime())
			return;
		const childTextNodes = Array.from(hhdr.childNodes)
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
	createNode(entry, indentLevel) {
		const button = this.#createCollapseButton(entry);
		const content = this.#createCollapseContent(entry);
		const container = this.#createCollapseContainer(entry);
		container.appendChild(button);
		container.appendChild(content);
		const node = this.#createIndentNode(container, indentLevel);
		return node;
	}
	#createCollapseButton(entry) {
		const button = document.createElement("button");
		button.entry = entry;
		button.classList.add("collapse-button");
		if (!entry.isViewed)
			button.classList.add("active");
		button.addEventListener("click", this.#buttonClickListener);
		const headerNode = this.#createSummaryNode(entry);
		button.appendChild(headerNode);
		return button;
	}
	#createCollapseContent(entry) {
		const content = document.createElement("div");
		content.classList.add("collapse-content");
		const contentNode = entry.item;
		content.appendChild(contentNode);
		if (entry.isViewed) {
			content.style.maxHeight = 0;
			content.classList.add("cc-hidden");
		}
		content.addEventListener("transitionend", this.#contentTransitionEndListener);
		return content;
	}
	#createCollapseContainer(entry) {
		const container = document.createElement("div");
		container.classList.add("collapse-container");
		container.dataset.corpus = entry.corpus;
		return container;
	}
	#createSummaryNode(entry) {
		const childNodes = [
			document.createTextNode(" "),
			document.createTextNode(entry.statusCode),
			document.createTextNode(" | "),
			document.createTextNode(entry.date.toLocaleString(undefined, localeOptions)),
			this.#createJapaneseTextNode("【" + entry.expression + "】"),
			document.createTextNode(entry.recentSubmitters.join(", ")),
		];
		const summaryNode = document.createElement("div");
		if (entry.isPending)
			summaryNode.classList.add("pending");
		childNodes.forEach(node => {
			summaryNode.appendChild(node);
		});
		return summaryNode;
	}
	#createJapaneseTextNode(text) {
		const span = document.createElement("span");
		span.lang = "ja";
		span.textContent = text;
		return span;
	}
	#createIndentNode(childNode, indentLevel) {
		const indentNode = document.createElement("div");
		indentNode.classList.add("indent");
		indentNode.style = "--indent: " + indentLevel;
		indentNode.appendChild(childNode);
		return indentNode;
	}
	#buttonClickListener() {
		const button = this;
		const content = this.nextElementSibling;
		const entry = this.entry;
		if (content.style.maxHeight === "")
			content.style.maxHeight = content.scrollHeight + "px";
		button.classList.add("active");
		content.classList.add("cc-transition");
		content.style.transitionDuration = (content.scrollHeight / 3000) + "s";
		if (content.classList.contains("cc-hidden")) {
			entry.isViewed = false;
			content.style.maxHeight = CollapsibleContent.getMaxScrollHeight(content) + "px";
			content.classList.remove("cc-hidden");
		} else {
			entry.isViewed = true;
			content.style.maxHeight = 0;
			content.classList.add("cc-hidden");
		}
	}
	#contentTransitionEndListener() {
		const button = this.previousElementSibling;
		const content = this;
		content.classList.remove('cc-transition');
		if (content.classList.contains("cc-hidden"))
			button.classList.remove("active");
	}
	static getMaxScrollHeight(content) {
		const walkNodeTree = function(node, f) {
			node.childNodes.forEach(childNode => {
				f(childNode);
				walkNodeTree(childNode, f);
			})
		}
		const showNode = function(node) {
			if (node.style?.display === "none") {
				node.style.removeProperty("display");
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


class DateNavigation {
	#pageURL;
	#y;
	#m;
	#d;
	#n;
	#pageDate;
	constructor(pageURL) {
		this.#pageURL = pageURL;
		this.#y = this.#parseParameter("y");
		this.#m = this.#parseParameter("m");
		this.#d = this.#parseParameter("d");
		this.#n = this.#parseParameter("n");
		this.#pageDate = this.#getPageDate();
	}
	#parseParameter(param) {
		const urlParams = new URLSearchParams(this.#pageURL.search);
		let val;
		if (urlParams.has(param) && !Number.isNaN(parseInt(urlParams.get(param))))
			val = parseInt(urlParams.get(param));
		else
			val = null;
		return val;
	}
	#getPageDate() {
		const date = new Date();
		if (this.#y !== null)
			date.setUTCFullYear(this.#y);
		if (this.#m !== null)
			date.setUTCMonth(this.#m - 1); // months range from 0 to 11 in javascript
		if (this.#d !== null)
			date.setUTCDate(this.#d);
		if (this.#n !== null)
			date.setUTCDate(date.getUTCDate() - this.#n)
		// Invalid dates will be NaN
		return Number.isNaN(date.getTime()) ? null : date;
	}
	createLinks() {
		const container = document.createElement("div");
		container.classList.add("date-navigation");
		const todayLink = this.#createTodayLink();
		todayLink.classList.add("date-navigation-today")
		container.appendChild(todayLink);
		const dateText = document.createElement("span");
		dateText.textContent = "Updates for " + this.#pageDate.toLocaleDateString([], { timeZone: "UTC" });
		container.appendChild(dateText);
		const nextLink = this.#createNextLink();
		if (nextLink !== null)
			container.appendChild(nextLink);
		const previousLink = this.#createPreviousLink();
		if (previousLink !== null)
			container.appendChild(previousLink);
		return container;
	}
	#createTodayLink() {
		if (this.#y === null && this.#m === null && this.#d === null && this.#n === null)
			return document.createElement("span");
		const linkLocation = new URL(this.#pageURL);
		linkLocation.searchParams.delete('y');
		linkLocation.searchParams.delete('m');
		linkLocation.searchParams.delete('d');
		linkLocation.searchParams.delete('n');
		return this.#createLinkElement(linkLocation.href, "Return to Today's Updates")
	}
	#createNextLink() {
		return this.#createOffsetLink(1, "Next Day");
	}
	#createPreviousLink() {
		return this.#createOffsetLink(-1, "Previous Day");
	}
	#createOffsetLink(offset, textContent) {
		if (this.#pageDate === null)
			return null;
		const linkDate = new Date(this.#pageDate);
		linkDate.setUTCDate(linkDate.getUTCDate() + offset);
		if ((new Date()).getTime() < linkDate.getTime())
			return null; // don't let the user browse to the future
		const linkLocation = new URL(this.#pageURL);
		linkLocation.searchParams.set('y', linkDate.getUTCFullYear());
		linkLocation.searchParams.set('m', linkDate.getUTCMonth() + 1); // months range from 0 to 11 in javascript
		linkLocation.searchParams.set('d', linkDate.getUTCDate());
		linkLocation.searchParams.delete('n');
		return this.#createLinkElement(linkLocation.href, textContent)
	}
	#createLinkElement(href, textContent) {
		const link = document.createElement("a");
		link.href = href;
		link.textContent = textContent
		return link;
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
           .collapse-container[data-corpus="jmnedict"] .collapse-button,
           .collapse-container[data-corpus="jmnedict"] .item {
             background-color: lavender;
           }
           .collapse-container[data-corpus="jmnedict"] .collapse-button.active {
             background-color: revert;
           }
           .collapse-container[data-corpus="test"] .collapse-button,
           .collapse-container[data-corpus="test"] .item {
             background-color: antiquewhite;
           }
           .collapse-container[data-corpus="test"] .collapse-button.active {
             background-color: revert;
           }
           .jmd-footer {
             height: 90vh; /* prevent the scroll from jumping around when collapsing content near the bottom of the page */
           }
           .date-navigation {
             display: flex;
             column-gap: 0.5rem;
           }
           .date-navigation-today {
             flex-grow: 1;
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
           }
           .collapse-button.active {
             border-radius: 10px 10px 0px 0px;
           }
           .collapse-button > .pending::before {
             content: "＊";
             position: absolute;
             left: 30px;
             margin-left: calc(3vw * var(--indent));
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


function main() {
	const styleNode = createStyleNode();
	document.head.appendChild(styleNode);

	const dateNav = new DateNavigation(document.location);
	const dateNavLinks = dateNav.createLinks();
	const documentBodyContent = document.querySelector(".jmd-content");
	documentBodyContent.appendChild(dateNavLinks);

	const entryTree = new EntryTree();
	document.querySelectorAll(".item").forEach(item => {
		item.remove();
		const entry = new Entry(item);
		entryTree.add(entry);
	});

	const cc = new CollapsibleContent();
	entryTree.branches().forEach(entryBranch => {
		entryBranch.forEach((entry, index) => {
			const node = cc.createNode(entry, index);
			documentBodyContent.appendChild(node);
		})
	});
}


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
