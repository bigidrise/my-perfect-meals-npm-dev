/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/i18n";
import OrganizationPaidSuccessPrompt from "@/components/business/OrganizationPaidSuccessPrompt";

jest.mock("@/components/ui/universal-modal", () => ({
  UniversalDialog: ({ open, title, description, footer }: any) => open ? (
    <div role="dialog"><h2>{title}</h2><p>{description}</p>{footer}</div>
  ) : null,
}));

const locales = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "vi", "tl"];
afterEach(async () => { await i18n.changeLanguage("en"); });

test.each(locales)("success prompt uses actual %s translations for both affiliate states", async locale => {
  await i18n.changeLanguage(locale);
  const text = (key: string): string => {
    const value = i18n.getResource(locale, "translation", `organizationPaidSuccess.${key}`);
    expect(typeof value).toBe("string");
    expect(value.trim().length).toBeGreaterThan(0);
    return value;
  };
  const onContinue = jest.fn();
  const onDismiss = jest.fn();
  const view = render(<OrganizationPaidSuccessPrompt open hasLinkedRewardful={false}
    onContinue={onContinue} onDismiss={onDismiss} />);
  expect(screen.getByRole("heading").textContent).toBe(text("title"));
  expect(screen.getByText(text("setupDescription"))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: text("setup") }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: text("later") }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  view.rerender(<OrganizationPaidSuccessPrompt open hasLinkedRewardful
    onContinue={onContinue} onDismiss={onDismiss} />);
  expect(screen.getByText(text("linkedDescription"))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: text("manage") }));
  expect(onContinue).toHaveBeenCalledTimes(2);
  view.rerender(<OrganizationPaidSuccessPrompt open={false} hasLinkedRewardful
    onContinue={onContinue} onDismiss={onDismiss} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
