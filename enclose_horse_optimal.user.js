// ==UserScript==
// @name         Enclose Horse Optimal Score Display
// @namespace    http://tampermonkey.net/
// @version      1.3
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
    const mainLevelId = window.__LEVEL__?.id;
    if (!mainLevelId) console.warn('[OptimalScore] __LEVEL__.id not available at init time');

    let bonusScore = null;
    let bonusFetchStarted = false;
    let inBonus = false;

    // Capture the initial --grass-bg value. The inline script at the top of the page sets
    // this before our script runs, so it represents the main puzzle's theme color.
    let mainGrassBg = document.documentElement.style.getPropertyValue('--grass-bg') || null;

    const div = document.createElement('div');
    div.textContent = `Optimal Score: ${mainScore}`;
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

    function fetchBonusScore(bonusLevelId) {
        if (bonusFetchStarted) return;
        bonusFetchStarted = true;
        fetch(`/api/levels/${bonusLevelId}/stats`)
            .then(r => r.json())
            .then(stats => {
                if (stats?.optimalScore !== undefined) {
                    bonusScore = stats.optimalScore;
                    if (inBonus) updateDisplay();
                }
            })
            .catch(() => {});
    }

    // Method 1: Intercept fetch to /api/daily/bonus/ to get the bonus level ID,
    // then fetch its optimal score from the stats endpoint.
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const response = await origFetch.apply(this, args);

        if (url.includes('/api/daily/bonus/') && !bonusFetchStarted) {
            response.clone().json()
                .then(data => { if (data?.id) fetchBonusScore(data.id); })
                .catch(() => {});
        }

        return response;
    };

    // Method 2: Intercept setProperty on the root element to detect --grass-bg changes.
    // The game calls style.setProperty('--grass-bg', ...) when switching between the main
    // puzzle theme and the bonus theme, which is the most reliable mode-change signal.
    // Using setProperty interception instead of MutationObserver avoids a race condition
    // where the CSS changes before inBonus is set, causing mainGrassBg to be overwritten.
    const rootStyle = document.documentElement.style;
    const nativeSetProperty = rootStyle.setProperty.bind(rootStyle);
    rootStyle.setProperty = function(name, value, priority) {
        if (name === '--grass-bg') {
            if (mainGrassBg === null) {
                // Shouldn't happen since inline script runs first, but capture it just in case.
                mainGrassBg = value;
            } else if (!inBonus && value !== mainGrassBg) {
                // Theme changed away from the main color → entering bonus round.
                inBonus = true;
                // If Method 1 (fetch interception) didn't already get the bonus score,
                // fetch it now via the bonus API using the known main level ID.
                if (!bonusFetchStarted && mainLevelId) {
                    origFetch(`/api/daily/bonus/${mainLevelId}`)
                        .then(r => r.json())
                        .then(data => { if (data?.id) fetchBonusScore(data.id); })
                        .catch(() => {});
                }
                updateDisplay();
            } else if (inBonus && value === mainGrassBg) {
                // Theme reverted to the main color → back to main puzzle.
                inBonus = false;
                updateDisplay();
            }
        }
        return nativeSetProperty(name, value, priority);
    };
})();
