/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import { shoppingProductOptionsEnabled } from "@/lib/shoppingProductOptionsGate";
import type { ShoppingListItem } from "@/stores/shoppingListStore";

test.each([true, false])("released olive-oil button renders with subscription access=%s", hasAccess => {
  const onChoose = jest.fn();
  const onUpgrade = jest.fn();
  render(<SmartShoppingProductChoice
    item={{ id: "synthetic-oil", name: "olive oil" } as ShoppingListItem}
    enabled={shoppingProductOptionsEnabled}
    hasAccess={hasAccess}
    onChoose={onChoose}
    onUpgrade={onUpgrade}
    onClear={jest.fn()}
  />);
  const button = screen.getByRole("button", { name: "See Product Options" });
  expect(onChoose).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(onChoose).toHaveBeenCalledTimes(hasAccess ? 1 : 0);
  expect(onUpgrade).toHaveBeenCalledTimes(hasAccess ? 0 : 1);
});
