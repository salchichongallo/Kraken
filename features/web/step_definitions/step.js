const { Given, When, Then } = require('@cucumber/cucumber');

Given('I open the webpage', async function () {
  await this.deviceClient.browser.url('https://example.com');
});

Then('I see the title', async function () {
  const title = await this.deviceClient.browser.execute(() => document.title);
  console.log('Page title:', title);
});

Then('I wait and capture the page', async function () {
  await this.deviceClient.browser.pause(3000);
  const screenshot = await this.deviceClient.browser.takeScreenshot();
  console.log('Captured screenshot:', screenshot);
});
