let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function markShuttingDown(): void {
  shuttingDown = true;
}

/** @internal Test-only hook to reset between runs */
export function _resetLifecycle(): void {
  shuttingDown = false;
}
