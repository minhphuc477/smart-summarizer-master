import { useCallback, useState } from 'react';

/**
 * Small hook to manage a single async action's running state and prevent double submissions.
 * Usage: const { run, isRunning } = useAsyncAction(); await run(async () => { ... });
 */
export default function useAsyncAction() {
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    if (isRunning) return undefined as unknown as T;
    setIsRunning(true);
    try {
      const res = await fn();
      return res as T;
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  return { run, isRunning } as const;
}
