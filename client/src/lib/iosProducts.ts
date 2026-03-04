import type { LookupKey } from "@/data/planSkus";

export interface IosProduct {
  productId: string;
  internalSku: LookupKey;
  label: string;
  price: number;
}

export const IOS_PRODUCTS: IosProduct[] = [
  {
    productId: "mpm.sub.basic.monthly.v1",
    internalSku: "mpm_basic_monthly",
    label: "Basic",
    price: 14.99,
  },
  {
    productId: "mpm.sub.premium.monthly.v1",
    internalSku: "mpm_premium_monthly",
    label: "Premium",
    price: 24.99,
  },
  {
    productId: "mpm.sub.ultimate.monthly.v1",
    internalSku: "mpm_ultimate_monthly",
    label: "Ultimate",
    price: 34.99,
  },
];

export const IOS_PRODUCT_IDS = IOS_PRODUCTS.map((p) => p.productId);

export function getIosProductByInternalSku(
  internalSku: LookupKey,
): IosProduct | undefined {
  return IOS_PRODUCTS.find((p) => p.internalSku === internalSku);
}

export function getIosProductByProductId(
  productId: string,
): IosProduct | undefined {
  return IOS_PRODUCTS.find((p) => p.productId === productId);
}

export function internalSkuToIosProductId(
  internalSku: LookupKey,
): string | undefined {
  return getIosProductByInternalSku(internalSku)?.productId;
}

export function iosProductIdToInternalSku(
  productId: string,
): LookupKey | undefined {
  return getIosProductByProductId(productId)?.internalSku;
}
