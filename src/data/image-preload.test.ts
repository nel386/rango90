import assert from "node:assert/strict";
import { imageRequestIsCurrent, preloadImage } from "./image-preload";

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() { FakeImage.instances.push(this); }
}

void (async () => {
  FakeImage.instances = [];
  const fast = preloadImage({ primary: "fast.jpg", fallback: "fast-fallback.jpg" }, FakeImage as unknown as typeof Image);
  assert.equal(FakeImage.instances.length, 1);
  FakeImage.instances[0]!.onload?.();
  assert.equal(await fast, "loaded");

FakeImage.instances = [];
const fallback = preloadImage({ primary: "broken.jpg", fallback: "fallback.jpg" }, FakeImage as unknown as typeof Image);
FakeImage.instances[0]!.onerror?.();
assert.equal(FakeImage.instances[0]!.src, "fallback.jpg");
FakeImage.instances[0]!.onload?.();
assert.equal(await fallback, "loaded");

FakeImage.instances = [];
const failed = preloadImage({ primary: "broken.jpg", fallback: "fallback.jpg" }, FakeImage as unknown as typeof Image);
FakeImage.instances[0]!.onerror?.();
FakeImage.instances[0]!.onerror?.();
assert.equal(await failed, "failed");
assert.equal(await preloadImage({}, FakeImage as unknown as typeof Image), "empty");
const abortController = new AbortController();
FakeImage.instances = [];
const cancelled = preloadImage({ primary: "slow.jpg", signal: abortController.signal }, FakeImage as unknown as typeof Image);
abortController.abort();
assert.equal(await cancelled, "cancelled");
assert.equal(imageRequestIsCurrent(4, 4), true);
assert.equal(imageRequestIsCurrent(4, 5), false);
  console.log("image-preload tests passed");
})().catch((error: unknown) => { throw error; });
