import { PNG } from 'pngjs';

// No antialias exemption or percentage allowance: every decoded RGBA channel must match.
export function comparePng(actualBytes, expectedBytes) {
  const actual = PNG.sync.read(actualBytes), expected = PNG.sync.read(expectedBytes);
  const width = Math.max(actual.width, expected.width), height = Math.max(actual.height, expected.height);
  const diff = new PNG({ width, height });
  let differentPixels = 0, maxChannelDelta = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const output = (y * width + x) * 4;
    const missing = x >= actual.width || x >= expected.width || y >= actual.height || y >= expected.height;
    let changed = missing;
    for (let channel = 0; channel < 4 && !missing; channel++) {
      const delta = Math.abs(actual.data[(y * actual.width + x) * 4 + channel] - expected.data[(y * expected.width + x) * 4 + channel]);
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      changed ||= delta !== 0;
    }
    if (changed) differentPixels++;
    diff.data[output] = changed ? 255 : 0;
    diff.data[output + 1] = 0;
    diff.data[output + 2] = changed ? 255 : 0;
    diff.data[output + 3] = 255;
  }
  const dimensionsMatch = actual.width === expected.width && actual.height === expected.height;
  return { passed: dimensionsMatch && differentPixels === 0, dimensionsMatch,
    actual: { width: actual.width, height: actual.height }, expected: { width: expected.width, height: expected.height },
    differentPixels, maxChannelDelta, threshold: 0, diff: PNG.sync.write(diff) };
}
