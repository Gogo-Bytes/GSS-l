import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { comparePng } from './visual.mjs';

function image(width = 2, height = 2) {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return png;
}
describe('task-board exact decoded RGBA comparator', () => {
  it('compares pixels, not PNG encoding bytes', () => {
    const png = image();
    const actual = PNG.sync.write(png, { deflateLevel: 0 });
    const expected = PNG.sync.write(png, { deflateLevel: 9 });
    expect(actual.equals(expected)).toBe(false);
    expect(comparePng(actual, expected)).toMatchObject({ passed: true, differentPixels: 0, maxChannelDelta: 0 });
  });
  it.each([0, 1, 2, 3])('rejects a one-unit change in channel %i and marks the diff', (channel) => {
    const png = image(), expected = PNG.sync.write(png);
    png.data[channel]--;
    const result = comparePng(PNG.sync.write(png), expected);
    expect(result).toMatchObject({ passed: false, differentPixels: 1, maxChannelDelta: 1, threshold: 0 });
    expect([...PNG.sync.read(result.diff).data.slice(0, 4)]).toEqual([255, 0, 255, 255]);
  });
  it('rejects different dimensions even with equal pixel counts', () => {
    expect(comparePng(PNG.sync.write(image(1, 4)), PNG.sync.write(image(2, 2))))
      .toMatchObject({ passed: false, dimensionsMatch: false });
  });
  it('rejects undecodable images', () => {
    expect(() => comparePng(new Uint8Array(), PNG.sync.write(image()))).toThrow();
  });
});
