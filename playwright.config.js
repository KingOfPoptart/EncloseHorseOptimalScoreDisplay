// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        browserName: 'firefox',
        headless: true,
    },
    projects: [
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
    ],
});
