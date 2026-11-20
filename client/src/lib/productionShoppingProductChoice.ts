import { apiRequest } from "@/lib/apiRequest";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { assertShoppingMetadataEndpoint } from "@/lib/shoppingMetadataTransport";
import {
  makeIngredientMetadata,
  parseIngredientMetadata,
} from "@shared/shoppingIngredientMetadata";
import {
  canonicalShoppingIngredient,
  shoppingIngredientSignature,
  parseShoppingProductSelection,
  parseShoppingProductReference,
  type ShoppingProductSelection,
  type ShoppingProductReference,
} from "@shared/shoppingProductSelection";

let pending = Promise.resolve();

export function saveProductionShoppingProductChoice(
  ids: string[],
  input: ShoppingProductSelection | ShoppingProductReference | null,
  reference = false,
): Promise<void> {
  const accountId = typeof localStorage === "undefined"
    ? null
    : localStorage.getItem("userId");

  const operation = pending.then(async () => {
    if (!accountId) throw new Error("Sign in before choosing a product.");
    if (localStorage.getItem("userId") !== accountId) {
      throw new Error("Shopping account changed before saving. Nothing was saved.");
    }

    const selection = reference
      ? parseShoppingProductReference(input)
      : input === null ? null : parseShoppingProductSelection(input);

    const assertAccount = () => {
      if (localStorage.getItem("userId") !== accountId) {
        throw new Error("Shopping account changed. Refresh before continuing.");
      }
    };

    const store = useShoppingListStore.getState();
    const uniqueIds = [...new Set(ids)];

    if (!uniqueIds.length) {
      throw new Error("This shopping ingredient is no longer available.");
    }

    const targets = uniqueIds.map(id => store.items.find(item => item.id === id));

    if (targets.some(item => !item?.serverId || (item.sourceRowCount ?? 1) > 1)) {
      throw new Error("This shopping group needs to be refreshed before choosing a product.");
    }

    const response = await apiRequest("/api/shopping-list-v2/");
    assertAccount();
    assertShoppingMetadataEndpoint(response, accountId);

    const serverRows = response.items || [];

    if (!Array.isArray(serverRows)) {
      throw new Error("Shopping server returned an invalid list.");
    }

    // Legacy consolidation can hide multiple database rows behind one item.
    // Refuse ambiguous identities rather than update only part of a group.
    for (const item of targets) {
      const matches = serverRows.filter((row: any) =>
        row.userId === accountId &&
        row.name.trim().toLowerCase() === item!.name.trim().toLowerCase() &&
        (row.unit || "").trim().toLowerCase() ===
          (item!.unit || "").trim().toLowerCase()
      );

      if (matches.length !== 1) {
        throw new Error(
          "This shopping ingredient has multiple or missing server records. Refresh before choosing a product."
        );
      }
    }

    // Require every target to have an exact, account-owned server record.
    const verified = targets.map(item => {
      const row = serverRows.find((r: any) => r.id === item!.serverId);
      if (!row || row.userId !== accountId) {
        throw new Error("Shopping record could not be verified.");
      }
      if (
        row.name !== item!.name ||
        Number(row.quantity) !== item!.quantity ||
        (row.unit || "") !== (item!.unit || "")
      ) {
        throw new Error("Shopping ingredient changed. Refresh before choosing.");
      }
      return { item: item!, row };
    });

    // Validate the entire selection before writing the first record.
    for (const { item, row } of verified) {
      const metadata = parseIngredientMetadata(row.ingredientMetadata);
      const ingredient = canonicalShoppingIngredient({
        originalName: metadata?.ingredient.originalName || row.name,
        requirements: metadata?.ingredient.requirements || [],
      });

      if (selection && (
        selection.product.assessment.subjectReference !== accountId ||
        shoppingIngredientSignature(ingredient) !==
          shoppingIngredientSignature(selection.ingredient)
      )) {
        throw new Error("Product selection does not match this account and ingredient.");
      }

      if (
        item.ingredientMetadata &&
        JSON.stringify(item.ingredientMetadata) !== JSON.stringify(metadata)
      ) {
        throw new Error("Shopping metadata changed. Refresh before choosing.");
      }
    }

    for (const { item, row } of verified) {
      assertAccount();

      const latest = useShoppingListStore.getState().items.find(i => i.id === item.id);
      if (!latest || JSON.stringify(latest) !== JSON.stringify(item)) {
        throw new Error("Shopping list changed during selection. Refresh before continuing.");
      }

      const metadata = parseIngredientMetadata(row.ingredientMetadata) ||
        makeIngredientMetadata({
          name: row.name,
          quantity: Number(row.quantity),
          unit: row.unit || "",
        });

      const ingredientMetadata = {
        ...metadata,
        selectedProduct: selection?.product || null,
      };

      const listBeforeSave = useShoppingListStore.getState().items;

      const saved = await apiRequest(`/api/shopping-list-v2/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ingredientMetadata }),
      });

      assertAccount();

      const confirmed = parseIngredientMetadata(saved?.item?.ingredientMetadata);

      if (
        saved?.item?.id !== row.id ||
        saved?.item?.userId !== accountId ||
        !confirmed ||
        JSON.stringify(confirmed.selectedProduct) !==
          JSON.stringify(ingredientMetadata.selectedProduct) ||
        JSON.stringify(confirmed.contributions) !==
          JSON.stringify(metadata.contributions)
      ) {
        throw new Error("Server did not confirm the product choice. Refresh the list.");
      }

      const current = useShoppingListStore.getState();
      const currentItem = current.items.find(i => i.id === item.id);

      if (
        current.items !== listBeforeSave ||
        !currentItem ||
        JSON.stringify(currentItem) !== JSON.stringify(item)
      ) {
        throw new Error("Shopping list changed while saving. Refresh before continuing.");
      }

      current.replaceItems(current.items.map(i =>
        i.id === item.id
          ? {
              ...i,
              ingredientMetadata: confirmed,
              productKey: selection?.product.productKey || undefined,
            }
          : i
      ));
    }
  });

  pending = operation.catch(() => {});
  return operation;
}
