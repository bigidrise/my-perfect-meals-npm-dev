/** Never send the new metadata contract to the older Production API. */
export function assertShoppingMetadataEndpoint(response: any, expectedOwner?: string | null) {
  if (response?.shoppingMetadataVersion !== 1) {
    throw new Error("This shopping API does not support Development ingredient metadata. Nothing was saved.");
  }
  if (expectedOwner && response.ownerUserId !== expectedOwner) {
    throw new Error("Shopping account changed. Refresh before saving.");
  }
}
