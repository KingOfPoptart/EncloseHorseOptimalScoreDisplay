// ==UserScript==
// @name         Enclose Horse Optimal Score Display
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Display optimal score for today's puzzle, including bonus round
// @match        https://enclose.horse/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = false;
    function log(...args) { if (DEBUG) console.log(...args); }

    const dateMatch = window.location.pathname.match(/\/play\/(\d{4}-\d{2}-\d{2})/);
    let level = null;
    if (dateMatch) {
        const targetDate = dateMatch[1];
        log('Target Date:', targetDate);
        level = window.__DAILY_LEVELS__.find(l => l.date === targetDate);
    } else {
        // yyyy-mm-dd in local time
        const today = new Date().toLocaleString('sv').split(' ')[0];
        log("Today's date:", today);
        level = window.__DAILY_LEVELS__.find(l => l.date === today);
    }
    log('Level info:', level);

    if (!level) return;

    const mainScore = level.optimalScore;
    // bonusOptimalScore is provided directly in __DAILY_LEVELS__; null means no bonus today.
    const bonusScore = level.bonusOptimalScore ?? null;
    let inBonus = false;

    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.bottom = '10px';
    div.style.right = '10px';
    div.style.background = 'rgba(0,0,0,0.7)';
    div.style.color = '#fff';
    div.style.padding = '8px 12px';
    div.style.fontFamily = 'Schoolbell, cursive';
    div.style.fontSize = '16px';
    div.style.zIndex = '1000';
    div.style.borderRadius = '4px';
    document.body.appendChild(div);

    function updateDisplay() {
        if (inBonus && bonusScore !== null) {
            div.textContent = `Bonus Optimal Score: ${bonusScore}`;
        } else {
            div.textContent = `Optimal Score: ${mainScore}`;
        }
    }
    updateDisplay();

    if (bonusScore !== null) {
        // Detect bonus mode by checking whether the theme selector is disabled.
        // When the player switches to the bonus round, the game calls
        // setBonusRoundActive(true), which sets themeSelect.disabled = true and adds
        // a .bonus-theme-note element. When switching back it calls
        // setBonusRoundActive(false) and re-enables the selector.
        // Polling every 200 ms is simpler and more robust than a MutationObserver.
        setInterval(() => {
            const themeSelect = document.getElementById('themeSelect');
            if (!themeSelect) return;
            const nowInBonus = themeSelect.disabled;
            if (nowInBonus !== inBonus) {
                inBonus = nowInBonus;
                updateDisplay();
            }
        }, 200);
    }
})();
