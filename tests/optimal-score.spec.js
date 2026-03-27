// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const scriptContent = fs.readFileSync(
    path.join(__dirname, '..', 'enclose_horse_optimal.user.js'),
    'utf8'
);

// Strip the ==UserScript== metadata block so we can inject the raw IIFE
const scriptBody = scriptContent.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m, '').trim();

/** Navigate to a URL and inject the userscript after the page's own JS has run. */
async function gotoAndInject(page, url) {
    await page.goto(url);
    // document-idle = after DOMContentLoaded + all deferred scripts
    await page.waitForLoadState('networkidle');
    await page.evaluate(scriptBody);
}

/**
 * Simulate the game calling setBonusRoundActive(true).
 * The real signal is themeSelect.disabled = true.
 */
async function activateBonus(page) {
    await page.evaluate(() => {
        document.getElementById('themeSelect').disabled = true;
    });
}

/** Simulate the game calling setBonusRoundActive(false). */
async function activateMain(page) {
    await page.evaluate(() => {
        document.getElementById('themeSelect').disabled = false;
    });
}

test.describe('Enclose Horse Optimal Score Display', () => {
    test('shows optimal score overlay on main puzzle page', async ({ page }) => {
        await gotoAndInject(page, 'https://enclose.horse/');

        const overlay = page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ });
        await expect(overlay).toBeVisible({ timeout: 10000 });

        const score = parseInt((await overlay.textContent()).replace('Optimal Score: ', ''));
        expect(score).toBeGreaterThan(0);
    });

    test('shows correct score for a specific date URL', async ({ page }) => {
        // 2025-12-30 is the earliest available date in __DAILY_LEVELS__
        await gotoAndInject(page, 'https://enclose.horse/play/2025-12-30');

        const overlay = page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ });
        await expect(overlay).toBeVisible({ timeout: 10000 });

        const score = parseInt((await overlay.textContent()).replace('Optimal Score: ', ''));
        expect(score).toBeGreaterThan(0);
    });

    test('overlay has correct visual style', async ({ page }) => {
        await gotoAndInject(page, 'https://enclose.horse/');

        const overlay = page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ });
        await expect(overlay).toBeVisible({ timeout: 10000 });

        await expect(overlay).toHaveCSS('position', 'fixed');
        await expect(overlay).toHaveCSS('bottom', '10px');
        await expect(overlay).toHaveCSS('right', '10px');
    });

    test('does not show overlay when no level matches', async ({ page }) => {
        await page.goto('https://enclose.horse/');
        await page.waitForLoadState('networkidle');

        // Overwrite __DAILY_LEVELS__ with an empty array so the lookup fails, then run script
        await page.evaluate(({ body }) => {
            window.__DAILY_LEVELS__ = [];
            eval(body);
        }, { body: scriptBody });

        await page.waitForTimeout(2000);

        const overlay = page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ });
        await expect(overlay).not.toBeVisible();
    });

    /**
     * Shared bonus round behaviour, run against each bonus style.
     * date, mainScore, bonusScore must be hardcoded knowns from __DAILY_LEVELS__.
     */
    function bonusTests(label, date, mainScore, bonusScore) {
        test.describe(`bonus round – ${label}`, () => {
            test('shows main score before bonus is activated', async ({ page }) => {
                await gotoAndInject(page, `https://enclose.horse/play/${date}`);

                const overlay = page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ });
                await expect(overlay).toBeVisible({ timeout: 10000 });
                await expect(overlay).toHaveText(`Optimal Score: ${mainScore}`);
            });

            test('switches to bonus score when bonus round is activated', async ({ page }) => {
                await gotoAndInject(page, `https://enclose.horse/play/${date}`);
                await page.locator('div').filter({ hasText: /^Optimal Score:/ }).waitFor({ timeout: 10000 });

                await activateBonus(page);

                await expect(page.locator('div').filter({ hasText: /^Bonus Optimal Score:/ }))
                    .toHaveText(`Bonus Optimal Score: ${bonusScore}`);
            });

            test('switches back to main score when returning to main round', async ({ page }) => {
                await gotoAndInject(page, `https://enclose.horse/play/${date}`);
                await page.locator('div').filter({ hasText: /^Optimal Score:/ }).waitFor({ timeout: 10000 });

                await activateBonus(page);
                await expect(page.locator('div').filter({ hasText: /^Bonus Optimal Score:/ })).toBeVisible();

                await activateMain(page);
                await expect(page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ }))
                    .toHaveText(`Optimal Score: ${mainScore}`);
            });
        });
    }

    // Current date — costlywalls style (new)
    bonusTests('costlywalls 2026-03-26', '2026-03-26', 98, 2);

    // Past date — lovebirds style (old)
    bonusTests('lovebirds 2026-03-24', '2026-03-24', 101, 66);

    test.describe('no bonus round', () => {
        // 2026-03-22 is a past date confirmed to have no bonus
        test('past date without bonus shows only main score', async ({ page }) => {
            await gotoAndInject(page, 'https://enclose.horse/play/2026-03-22');

            const overlay = page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ });
            await expect(overlay).toBeVisible({ timeout: 10000 });
            const mainText = await overlay.textContent();

            // themeSelect being disabled must not change the display
            await activateBonus(page);
            await page.waitForTimeout(500);
            await expect(overlay).toHaveText(mainText);
        });

        test('does not show overlay when no level data exists for date', async ({ page }) => {
            await page.goto('https://enclose.horse/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(({ body }) => {
                window.__DAILY_LEVELS__ = [];
                eval(body);
            }, { body: scriptBody });

            await page.waitForTimeout(2000);
            await expect(page.locator('div').filter({ hasText: /^Optimal Score: \d+$/ })).not.toBeVisible();
        });
    });

    test('still updates when themeSelect is recreated in the DOM', async ({ page }) => {
        await gotoAndInject(page, 'https://enclose.horse/play/2026-03-26');
        await page.locator('div').filter({ hasText: /^Optimal Score:/ }).waitFor({ timeout: 10000 });

        // Poll re-queries by ID each tick, so new nodes are picked up automatically
        await page.evaluate(() => {
            const old = document.getElementById('themeSelect');
            const parent = old.parentElement;
            old.remove();
            const fresh = document.createElement('select');
            fresh.id = 'themeSelect';
            fresh.disabled = true;
            parent.appendChild(fresh);
        });

        await expect(page.locator('div').filter({ hasText: /^Bonus Optimal Score:/ }))
            .toHaveText('Bonus Optimal Score: 2');
    });
});
