import {
  commitTextInputValue,
  limitTextInputValue,
  readAuthoritativeTextValue,
} from "../authoritativeTextInput";

describe("authoritative mobile text input", () => {
  test("submission prefers a predictive-text replacement visible in the field", () => {
    const textarea = { value: "chicken" } as HTMLTextAreaElement;

    expect(readAuthoritativeTextValue(textarea, "chi", 300)).toBe("chicken");
  });

  test("normal typing and pasted text are preserved exactly", () => {
    const textarea = { value: "chicken, broccoli" } as HTMLTextAreaElement;

    expect(readAuthoritativeTextValue(textarea, "chicken, broccoli")).toBe(
      "chicken, broccoli",
    );
  });

  test("voice updates remain authoritative when no mounted field is available", () => {
    expect(readAuthoritativeTextValue(null, "chicken by voice", 300)).toBe(
      "chicken by voice",
    );
  });

  test("composition completion commits the element's completed value", () => {
    const textarea = { value: "鶏肉" } as HTMLTextAreaElement;
    const setValue = jest.fn();

    commitTextInputValue(
      { currentTarget: textarea },
      setValue,
      300,
    );

    expect(setValue).toHaveBeenCalledWith("鶏肉");
  });

  test("repeated reads use the same current visible value", () => {
    const textarea = { value: "chicken" } as HTMLTextAreaElement;

    expect(readAuthoritativeTextValue(textarea, "chi", 300)).toBe("chicken");
    expect(readAuthoritativeTextValue(textarea, "chi", 300)).toBe("chicken");
  });

  test("existing character limits remain enforced", () => {
    expect(limitTextInputValue("chicken", 3)).toBe("chi");
  });
});