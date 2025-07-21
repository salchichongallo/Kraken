const { After, Before } = require('@cucumber/cucumber');
const { WebClient } = require('kraken-node');

Before(async function () {
  const browserOptions = process.env.CI
    ? {
        'goog:chromeOptions': { args: ['--headless'] },
      }
    : {};
  this.deviceClient = new WebClient('chrome', browserOptions, this.userId);
  this.driver = await this.deviceClient.startKrakenForUserId(this.userId);
});

After(async function () {
  await this.deviceClient.stopKrakenForUserId(this.userId);
});
