// ==UserScript==
// @name         Enclose Horse Optimal Score Display
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Display optimal score for today's puzzle
// @match        https://enclose.horse/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const dateMatch = window.location.pathname.match(/\/play\/(\d{4}-\d{2}-\d{2})/);
    const targetDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    const level = window.__DAILY_LEVELS__.find(l => l.date === targetDate);

    if (level) {
        const div = document.createElement('div');
        div.textContent = `Optimal Score: ${level.optimalScore}`;
        div.style.cssText = 'position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:#fff;padding:8px 12px;font-family:Schoolbell,cursive;font-size:16px;z-index:1000;border-radius:4px;';
        document.body.appendChild(div);
    }
})();
