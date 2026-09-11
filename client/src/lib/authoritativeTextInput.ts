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

export function commitTextInputValue(
  event: TextInputEvent,
  setValue: (value: string) => void,
  maxLength?: number,
): string {
  const value = limitTextInputValue(event.currentTarget.value, maxLength);
  setValue(value);
  return value;
}