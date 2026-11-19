/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ToastProvider, Toast, ToastTitle, ToastClose, ToastViewport } from "@/components/ui/toast";
import { SessionVerificationRecovery } from "@/components/SessionVerificationRecovery";
import { translateBasicValidation, translateSharedLabel } from "@/i18n/sharedLabels";
import { LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage("en"); });

test("mounted standard buttons switch EN → ES → EN, including icon-and-text children", async () => {
  render(<><Button>Save</Button><Button><span aria-hidden="true">+</span> Cancel </Button></>);
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Cancelar/ })).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
});

test("buttons preserve actions, custom content, disabled state and asChild semantics", async () => {
  await i18n.changeLanguage("es");
  const click = jest.fn();
  render(<><Button onClick={click}>Save</Button><Button disabled>Cancel</Button><Button asChild><a href="/safe">Custom destination</a></Button><Button>Save prescribed targets</Button></>);
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(click).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Custom destination" })).toHaveAttribute("href", "/safe");
  expect(screen.getByRole("button", { name: "Save prescribed targets" })).toBeInTheDocument();
});

test("dialog close control reacts to locale changes", async () => {
  render(<Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>Example</DialogTitle></DialogContent></Dialog>);
  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
});

test("mobile sheet close control is localized", async () => {
  await i18n.changeLanguage("es");
  render(<Sheet open><SheetContent aria-describedby={undefined}><SheetTitle>Example</SheetTitle></SheetContent></Sheet>);
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
});

test("confirmation actions use existing Spanish common labels without changing decisions", async () => {
  await i18n.changeLanguage("es");
  const confirm = jest.fn();
  render(<AlertDialog open><AlertDialogContent aria-describedby={undefined}><AlertDialogTitle>Example</AlertDialogTitle><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirm}>Confirm</AlertDialogAction></AlertDialogContent></AlertDialog>);
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(confirm).toHaveBeenCalledTimes(1);
});

test("common notification title and dismiss label are localized without translating custom prose", async () => {
  await i18n.changeLanguage("es");
  render(<ToastProvider><Toast open><ToastTitle>Something went wrong</ToastTitle><ToastClose /></Toast><ToastViewport /></ToastProvider>);
  expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  expect(translateSharedLabel("Keep sodium below 2,000 mg", i18n.t.bind(i18n))).toEqual(["Keep sodium below 2,000 mg"]);
});

test("only verified basic form messages are translated; numerical/clinical messages stay intact", async () => {
  await i18n.changeLanguage("es");
  expect(translateBasicValidation("Required", i18n.t.bind(i18n))).toBe("Obligatorio");
  expect(translateBasicValidation("Invalid email", i18n.t.bind(i18n))).toBe("Correo electrónico no válido");
  expect(translateBasicValidation("Limit: 150 mg", i18n.t.bind(i18n))).toBe("Limit: 150 mg");
});

test("the real shared form renders a localized required error and preserves input text", async () => {
  function RequiredForm() {
    const form = useForm({ defaultValues: { example: "typed draft" } });
    React.useEffect(() => { form.setError("example", { type: "required", message: "Required" }); }, [form]);
    return <Form {...form}><FormField control={form.control} name="example" render={({ field }) => <FormItem><FormControl><Input aria-label="example" {...field} /></FormControl><FormMessage /></FormItem>} /></Form>;
  }
  render(<RequiredForm />);
  expect(await screen.findByText("Required")).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByText("Obligatorio")).toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("typed draft");
});

test("session recovery explains failure and retry in Spanish without changing the callback", async () => {
  await i18n.changeLanguage("es");
  const retry = jest.fn();
  render(<SessionVerificationRecovery onRetry={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "Volver a verificar la sesión" }));
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos verificar tu sesión");
  expect(retry).toHaveBeenCalledTimes(1);
});

test("device language changes do not overwrite explicit choices or persist a resolved Auto value", async () => {
  const device = jest.spyOn(window.navigator, "language", "get").mockReturnValue("es-MX");
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "auto");
  await act(async () => { window.dispatchEvent(new Event("languagechange")); });
  expect(i18n.language).toBe("es");
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("auto");
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "en");
  await i18n.changeLanguage("en");
  await act(async () => { window.dispatchEvent(new Event("languagechange")); });
  expect(i18n.language).toBe("en");
  device.mockRestore();
});
