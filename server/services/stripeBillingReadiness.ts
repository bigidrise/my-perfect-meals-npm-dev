let stripeBillingReady = false;

export function markStripeBillingReady(): void {
  stripeBillingReady = true;
}

export function isStripeBillingReady(): boolean {
  return stripeBillingReady;
}