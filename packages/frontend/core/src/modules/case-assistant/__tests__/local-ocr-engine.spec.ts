import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ocrFromDataUrl } from '../services/local-ocr-engine';

describe('local-ocr-engine hardening', () => {
  const originalWorker = (globalThis as any).Worker;
  const originalOffscreenCanvas = (globalThis as any).OffscreenCanvas;

  beforeEach(() => {
    delete (globalThis as any).Worker;
    delete (globalThis as any).OffscreenCanvas;
  });

  afterEach(() => {
    if (originalWorker === undefined) {
      delete (globalThis as any).Worker;
    } else {
      (globalThis as any).Worker = originalWorker;
    }

    if (originalOffscreenCanvas === undefined) {
      delete (globalThis as any).OffscreenCanvas;
    } else {
      (globalThis as any).OffscreenCanvas = originalOffscreenCanvas;
    }
  });

  it('never throws for malformed image data URLs and returns structured OCR failure', async () => {
    const result = await ocrFromDataUrl('data:image/png;base64,@@@not-base64@@@', 'image/png');
    expect(result).toBeDefined();
    expect(typeof result.engine).toBe('string');
    expect(result.text).toBe('');
  });

  it('never throws on unknown mime routing with malformed payload', async () => {
    (globalThis as any).Worker = class {};
    (globalThis as any).OffscreenCanvas = class {
      constructor(_w: number, _h: number) {}
      getContext() {
        return {
          drawImage() {},
          getImageData() {
            return { data: new Uint8ClampedArray(0), width: 0, height: 0 } as ImageData;
          },
          putImageData() {},
          fillRect() {},
          translate() {},
          rotate() {},
        };
      }
    };

    const result = await ocrFromDataUrl('@@@not-base64@@@', 'application/octet-stream');
    expect(result).toBeDefined();
    expect(result.text).toBe('');
    expect(typeof result.engine).toBe('string');
    expect(result.engine.length).toBeGreaterThan(0);
  });
});
