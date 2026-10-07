import { test, expect } from "@playwright/test";

for (const url of ["/raw.html", "/bundle/"]) {
  test(`packed import ${url}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await expect(page.locator("#result")).toContainText(
      /^Passed \d+ packed browser checks; WASM loaded once\.$/,
    );
    expect(await page.evaluate(() => globalThis.consumerResult)).toMatchObject({
      ok: true,
      wasmLoads: 1,
    });
    expect(errors).toEqual([]);
  });
}
