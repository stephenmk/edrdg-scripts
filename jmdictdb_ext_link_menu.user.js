// ==UserScript==
// @name        JMdictDB external links
// @namespace   edrdg-scripts
// @version     2024.10.26.2
// @author      Stephen Kraus
// @match       *://*.edrdg.org/jmwsgi/updates.py*
// @match       *://*.edrdg.org/jmwsgi/entr.py*
// @match       *://*.edrdg.org/jmwsgi/edconf.py*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// @homepageURL https://github.com/stephenmk/edrdg-scripts
// @updateURL   https://github.com/stephenmk/edrdg-scripts/raw/main/jmdictdb_ext_link_menu.user.js
// ==/UserScript==
'use strict';

const ngramUrls = {
	"N-gram counts (Google)": "https://www.edrdg.org/~jwb/cgi-bin/ngramlookup?sent=$1",
	"N-gram counts (KM)":     "https://www.edrdg.org/~jwb/cgi-bin/ngramlookupwww?sent=$1",
}

const dictionaryUrls = {
	"Kotobank":            "https://kotobank.jp/gs/?q=$1",
	"Goo Jisho":           "https://dictionary.goo.ne.jp/srch/all/$1/m0u/",
	"Weblio":              "https://www.weblio.jp/content/$1",
	"Eijiro (ALC server)": "https://eow.alc.co.jp/search?q=$1",
	"Wadoku":              "https://www.wadoku.de/search/?q=$1",
	"WWWJDIC":             "https://www.edrdg.org/cgi-bin/wwwjdic/wwwjdic?1MUQ$1"
}

function makeLinkMenuStyleClasses() {
	const style = document.createElement('style');
	style.id = "external-links-style";
	style.innerText = `
          .link-menu-container {
            position: relative;
            display: inline-block;
          }
          .link-menu-content {
            display: none;
            border-style: ridge;
            border-radius: 5px;
            position: absolute;
            background-color: #feffef;
            min-width: 210px;
            box-shadow: 0px 20px 20px 0px rgba(0,0,0,0.5);
            z-index: 1;
          }
          .link-menu-content.active {
            display: block;
          }
          .link-menu-details {
            user-select: none;
          }
          .link-menu-item {
            display: block;
            padding: 2px 0px 2px 20px;
          }
          `;
	document.head.appendChild(style);
}

// Toggle the display of the link menu on button clicks
function makeMenuButtonClickListener() {
	const listener = (event) => {
		if (event.target.classList.contains("link-menu-button")) {
			const linkMenuContent = event.target.nextElementSibling;
			const doShowMenu = !linkMenuContent.classList.contains("active");
			hideAllLinkMenus();
			if (doShowMenu) {
				linkMenuContent.classList.add("active")
			}
		}
	}
	document.addEventListener("click", listener, false)
}

// Hide the menu after an outside click
function makeLinkMenuHideListener() {
	const listener = (event) => {
		let isLinkMenu = false;
		event.target.classList.forEach(className => {
			if (className.startsWith("link-menu")) {
				isLinkMenu = true;
			}
		})
		if (isLinkMenu) return;
		hideAllLinkMenus();
	}
	document.addEventListener("click", listener, false)
}

function hideAllLinkMenus() {
	document.querySelectorAll(".link-menu-content.active").forEach(element => {
		element.classList.remove('active')
	})
}

function makeLink(text, url, parameterList) {
	const linkElement = document.createElement("a");
	linkElement.textContent = text
	linkElement.href = url.replace("$1", parameterList.join('+'));
	linkElement.classList.add("link-menu-item");
	return linkElement;
}

function makeLinkHeading(text) {
	const spanNode = document.createElement("span");
	spanNode.textContent = "【" + text + "】";
	spanNode.lang = "ja";
	spanNode.classList.add("link-menu-heading");
	return spanNode;
}

function makeExpressionLinks(expression, index) {
	const summary = document.createElement("summary");
	summary.classList.add("link-menu-summary");
	summary.appendChild(makeLinkHeading(expression));
	const expressionLinks = document.createElement("details");
	if (index === 0) {
		expressionLinks.setAttribute("open", "");
	}
	expressionLinks.classList.add("link-menu-details");
	expressionLinks.appendChild(summary);
	Object.entries(dictionaryUrls).forEach(([titleText, url]) => {
		expressionLinks.appendChild(makeLink(titleText, url, [expression]));
	})
	return expressionLinks;
}

function makeLinkMenus() {
	document.querySelectorAll(".item").forEach(item => {
		const kanjiList = [];
		item.querySelectorAll(".kanj").forEach(kanji => {
			kanjiList.push(kanji.innerText)
		})

		const readingList = [];
		item.querySelectorAll(".rdng").forEach(reading => {
			readingList.push(reading.innerText)
		})
		if (readingList.length == 0) return;

		const allExpressions = kanjiList.concat(readingList);

		// Display links for all kanji expressions and the first reading.
		// If there are no kanji expressions, use all the readings.
		const linkExpressions = (kanjiList.length != 0) ?
			kanjiList.concat(readingList[0]) :
			readingList;

		const menuItems = [];
		Object.entries(ngramUrls).forEach(([titleText, url]) => {
			menuItems.push(makeLink(titleText, url, allExpressions))
		})
		linkExpressions.forEach((expression, idx) => {
			menuItems.push(makeExpressionLinks(expression, idx))
		})

		const linkMenuContent = document.createElement("div");
		linkMenuContent.classList.add("link-menu-content");
		menuItems.forEach(menuItem => {
			linkMenuContent.appendChild(menuItem);
		})

		const linkMenuButton = document.createElement("button");
		linkMenuButton.classList.add("link-menu-button");
		linkMenuButton.innerText = "External Links"

		const linkMenuContainer = document.createElement("div");
		linkMenuContainer.classList.add("link-menu-container");
		linkMenuContainer.appendChild(linkMenuButton);
		linkMenuContainer.appendChild(linkMenuContent);

		const firstLineBreak = item.querySelector("br");
		firstLineBreak.before(linkMenuContainer);
	})
}

function main() {
	if (document.getElementById("external-links-style")) {
		return;
	}
	makeLinkMenuStyleClasses();
	makeLinkMenus();
	makeMenuButtonClickListener();
	makeLinkMenuHideListener();
}

main();
