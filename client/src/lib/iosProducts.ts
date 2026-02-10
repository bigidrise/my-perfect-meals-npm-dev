import type { LookupKey } from "@/data/planSkus";

export interface IosProduct {
  productId: string;
  internalSku: LookupKey;
  label: string;
  price: number;
}

export const IOS_PRODUCTS: IosProduct[] = [
  {
    productId: "mpm_basic_plan_999",
    internalSku: "mpm_basic_monthly",
    label: "Basic",
    price: 9.99,
  },
  {
    productId: "mpm_premium_plan_1999",
    internalSku: "mpm_premium_monthly",
    label: "Premium",
    price: 19.99,
  },
  {
    productId: "mpm_ultimate_plan_2999",
    internalSku: "mpm_ultimate_monthly",
    label: "Ultimate",
    price: 29.99,
  },
];

export const IOS_PRODUCT_IDS = IOS_PRODUCTS.map((p) => p.productId);

export function getIosProductByInternalSku(
  internalSku: LookupKey
): IosProduct | undefined {
  return IOS_PRODUCTS.find((p) => p.internalSku === internalSku);
}

export function getIosProductByProductId(
  productId: string
): IosProduct | undefined {
  return IOS_PRODUCTS.find((p) => p.productId === productId);
}

export function internalSkuToIosProductId(
  internalSku: LookupKey
): string | undefined {
  return getIosProductByInternalSku(internalSku)?.productId;
}

export function iosProductIdToInternalSku(
  productId: string
): LookupKey | undefined {
  return getIosProductByProductId(productId)?.internalSku;
}
