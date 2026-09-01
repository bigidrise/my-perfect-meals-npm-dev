/**
 * Wait for one boot migration sequence.
 *
 * The timeout is only a warning boundary. Promise.race() does not cancel the
 * migration, so after a timeout we must await the same promise rather than
 * starting a second DDL sequence against the same database.
 */
export async function awaitSingleBootMigration(
  migration: Promise<void>,
  timeoutMs: number,
  onWarning: (error: unknown) => void,
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Migration timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([migration, timeout]);
  } catch (error) {
    onWarning(error);
    await migration;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}