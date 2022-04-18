// ==UserScript==
// @name        JMdictDB external links
// @namespace   edrdg-scripts
// @version     1.0
// @author      Stephen Kraus
// @match       *://*.edrdg.org/jmdictdb/cgi-bin/updates.py*
// @match       *://*.edrdg.org/jmdictdb/cgi-bin/entr.py*
// @match       *://*.edrdg.org/jmdictdb/cgi-bin/edconf.py*
// @icon        https://www.edrdg.org/favicon.ico
// @grant       none
// @run-at      document-end
// ==/UserScript==
'use strict';


const urls = {
	"google":   "https://www.edrdg.org/~jwb/cgi-bin/ngramlookup?sent=",
	"km":       "https://www.edrdg.org/~jwb/cgi-bin/ngramlookupwww?sent=",
	"kotobank": "https://kotobank.jp/gs/?q=",
	"eijiro":   "https://eow.alc.co.jp/search?q=",
	"wadoku":   "https://www.wadoku.de/search/?q="
}


function makeLinkMenuStyleClasses() {
	const style = document.createElement('style');
	style.innerText = `
          .linkMenuContainer {
            position: relative;
            display: inline-block;
          }
          .linkMenuButton {}
          .linkMenuContent {
            display: none;
            border-style: ridge;
            border-radius: 5px;
            position: absolute;
            background-color: #feffef;
            min-width: 210px;
            box-shadow: 0px 20px 20px 0px rgba(0,0,0,0.5);
            z-index: 1;
          }
          .linkMenuItem {
            display: block;
            padding: 2px 0px 2px 20px;
          }
          .linkMenuHeading {
            display: block;
            padding: 2px 0px 2px 2px;
          }
          .linkMenuContent.active {
            display: block;
          }`;
	document.head.appendChild(style);
}


// Toggle the display of the link menu on button clicks
function linkMenuButtonClick() {
	const linkMenuContent = this.nextElementSibling;
	const doShowMenu = !linkMenuContent.classList.contains("active");
	hideAllLinkMenus();
	if (doShowMenu) {
		linkMenuContent.classList.add("active")
	}
}


// Hide the menu after an outside click
function makeLinkMenuHideListener() {
	const listener = (event) => {
		let isLinkMenu = false;
		event.target.classList.forEach(className => {
			if (className.startsWith("linkMenu")) {
				isLinkMenu = true;
			}
		})
		if (isLinkMenu) return;
		hideAllLinkMenus();
	}
	document.addEventListener("click", listener, false)
}


function hideAllLinkMenus() {
	document.querySelectorAll(".linkMenuContent.active").forEach(element => {
		element.classList.remove('active')
	})
}


function makeLink(text, url, parameterList) {
	const linkElement = document.createElement("a");
	linkElement.textContent = text
	linkElement.href = url + parameterList.join('+');
	linkElement.classList.add("linkMenuItem");
	return linkElement;
}


function makeLinkHeading(text) {
	const spanNode = document.createElement("span");
	spanNode.textContent = "【" + text + "】";
	spanNode.lang="ja";
	spanNode.classList.add("linkMenuHeading");
	return spanNode;
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

		const menuItems = [
			makeLink("N-gram counts (Google)", urls["google"], allExpressions),
			makeLink("N-gram counts (KM)", urls["km"], allExpressions)
		]
		linkExpressions.forEach(expression => {
			menuItems.push(makeLinkHeading(expression))
			menuItems.push(makeLink("Kotobank", urls["kotobank"], [expression]))
			menuItems.push(makeLink("Eijiro (ALC server)", urls["eijiro"], [expression]))
			menuItems.push(makeLink("Wadoku", urls["wadoku"], [expression]))
		})

		const linkMenuContent = document.createElement("div");
		linkMenuContent.classList.add("linkMenuContent");
		menuItems.forEach(menuItem => {
			linkMenuContent.appendChild(menuItem);
		})

		const linkMenuButton = document.createElement("button");
		linkMenuButton.classList.add("linkMenuButton");
		linkMenuButton.innerText = "External Links"
		linkMenuButton.addEventListener("click", linkMenuButtonClick, false)

		const linkMenuContainer = document.createElement("div");
		linkMenuContainer.classList.add("linkMenuContainer");
		linkMenuContainer.appendChild(linkMenuButton);
		linkMenuContainer.appendChild(linkMenuContent);

		const firstLineBreak = item.querySelector("br");
		firstLineBreak.before(linkMenuContainer);
	})
}


function main() {
	makeLinkMenuStyleClasses();
	makeLinkMenus()
	makeLinkMenuHideListener();
}


// Starting the program this way prevents it from
// running again on return visits to cached pages
// (when running the program via greasemonkey).
window.addEventListener("load", main, false);
