type TextControl = HTMLInputElement | HTMLTextAreaElement;
type TextInputEvent = { currentTarget: TextControl };

export function limitTextInputValue(value: string, maxLength?: number): string {
  return typeof maxLength === "number" ? value.slice(0, maxLength) : value;
}

export function readAuthoritativeTextValue(
  element: TextControl | null,
  stateValue: string,
  maxLength?: number,
): string {
  return limitTextInputValue(element?.value ?? stateValue, maxLength);
}

export async function captureAuthoritativeTextValue(
  element: TextControl | null,
  stateValue: string,
  maxLength?: number,
): Promise<string> {
  element?.blur();
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
  return readAuthoritativeTextValue(element, stateValue, maxLength);
}

export function commitTextInputValue(
  event: TextInputEvent,
  setValue: (value: string) => void,
  maxLength?: number,
): string {
  const value = limitTextInputValue(event.currentTarget.value, maxLength);
  setValue(value);
  return value;
}