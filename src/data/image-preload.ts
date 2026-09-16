export type ImagePreloadResult = 'loaded' | 'failed' | 'cancelled' | 'empty';

export type ImagePreloadTarget = {
  primary?: string;
  fallback?: string;
  signal?: AbortSignal;
};

export function preloadImage(target: ImagePreloadTarget, ImageCtor: typeof Image = Image): Promise<ImagePreloadResult> {
  const primary = target.primary ?? target.fallback;
  if (!primary) return Promise.resolve('empty');
  return new Promise((resolve) => {
    const image = new ImageCtor();
    let settled = false;
    let cancel = () => undefined;
    const finish = (result: ImagePreloadResult) => {
      if (settled) return;
      settled = true;
      target.signal?.removeEventListener('abort', cancel);
      resolve(result);
    };
    cancel = () => {
      image.onload = null;
      image.onerror = null;
      finish('cancelled');
    };
    if (target.signal?.aborted) {
      finish('cancelled');
      return;
    }
    target.signal?.addEventListener('abort', cancel, { once: true });
    image.onload = () => finish('loaded');
    image.onerror = () => {
      if (target.fallback && target.fallback !== primary) {
        image.onload = () => finish('loaded');
        image.onerror = () => finish('failed');
        image.src = target.fallback;
      } else {
        finish('failed');
      }
    };
    image.src = primary;
  });
}

export function imageRequestIsCurrent(requestId: number, currentRequestId: number): boolean {
  return requestId === currentRequestId;
}
