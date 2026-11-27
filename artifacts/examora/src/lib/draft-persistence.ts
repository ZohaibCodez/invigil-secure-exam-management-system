export type DeviceWriteStatus = 'checking' | 'writing' | 'stored' | 'failed';
export type DeviceWriteState = { status: DeviceWriteStatus; error: string | null };
export const DEVICE_STORAGE_ERROR = 'This browser could not retain the latest work. Reloading or closing it may lose anything not confirmed by the server.';

/**
 * IndexedDB writes must finish in order. Only the most recently requested write
 * can confirm that the CURRENT draft is durable, even when older writes succeed.
 */
export function createDraftWriter<T>(
  write: (draft: T) => Promise<unknown>,
  publish: (state: DeviceWriteState) => void,
) {
  let sequence = 0;
  let error: string | null = null;
  let queue: Promise<void> = Promise.resolve();
  return (draft: T): Promise<void> => {
    const current = ++sequence;
    publish({ status: 'writing', error });
    queue = queue.catch(() => {}).then(() => write(draft)).then(() => {
      if (current === sequence) { error = null; publish({ status: 'stored', error }); }
    }, () => {
      if (current === sequence) { error = DEVICE_STORAGE_ERROR; publish({ status: 'failed', error }); }
    });
    return queue;
  };
}
