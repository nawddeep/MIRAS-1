import zlib from "node:zlib";
import { expect, test } from "@playwright/test";

/** Solid-colour PNG, so tests do not depend on any photo files. */
function png(w: number, h: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => rgb[i % 3])]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test("a dark photo is caught before upload", async ({ page }) => {
  let uploaded = false;
  page.on("request", (r) => r.url().includes("/api/camera/match") && (uploaded = true));
  await page.goto("/camera");
  await page.locator("input[type=file]:not([capture])").setInputFiles({ name: "dark.png", mimeType: "image/png", buffer: png(64, 64, [5, 5, 8]) });
  await expect(page.locator("main [role=alert]")).toContainText("too dark");
  expect(uploaded).toBe(false);
});

test("an out-of-set photo gets I don't know with a search box (mock provider never guesses)", async ({ page }) => {
  await page.goto("/camera");
  await page.locator("input[type=file]:not([capture])").setInputFiles({ name: "wall.png", mimeType: "image/png", buffer: png(64, 64, [200, 180, 160]) });
  const idk = page.getByTestId("i-dont-know");
  await expect(idk).toContainText("I don't know this one yet");
  await expect(idk.getByRole("searchbox")).toBeVisible();
});

test("the live (fake) camera frame goes through the same path", async ({ page }) => {
  await page.goto("/camera");
  await page.getByRole("button", { name: "Open camera" }).click();
  await page.getByRole("button", { name: "What is this?" }).click();
  await expect(page.getByTestId("i-dont-know").or(page.locator("main [role=alert]"))).toBeVisible();
});

test("demo mode: picking a place by hand shows its stories labelled Demo response", async ({ page }) => {
  await page.goto("/camera");
  await page.getByRole("button", { name: "Pichhola" }).click();
  const match = page.getByTestId("camera-match");
  await expect(match).toBeVisible();
  await expect(match.getByText("Demo response", { exact: true })).toBeVisible();
  await expect(match.getByTestId("story")).toHaveCount(3);
  await match.getByText("Story previews and source details").click();
  await expect(match.getByText("Sample content").first()).toBeVisible();
});
