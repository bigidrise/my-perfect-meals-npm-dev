import {
  inferProfessionalLegalAction,
  safeProfessionalReturnTo,
  createProfessionalLegalRecoveryUrl,
} from "../../client/src/lib/professionalLegalRecovery";

describe("professional legal recovery routing", () => {
  test("preserves safe same-origin destinations", () => {
    expect(safeProfessionalReturnTo("/care-team/trainer?invite=1"))
      .toBe("/care-team/trainer?invite=1");
    expect(safeProfessionalReturnTo("//example.com")).toBeNull();
    expect(safeProfessionalReturnTo("https://example.com")).toBeNull();
    expect(safeProfessionalReturnTo("/auth?returnTo=/care-team")).toBeNull();
    expect(safeProfessionalReturnTo("/procare-attestation")).toBeNull();
    expect(safeProfessionalReturnTo("/\\outside.example")).toBeNull();
    expect(safeProfessionalReturnTo("/\n/outside.example")).toBeNull();
  });

  test("recovery explicitly selects the agreement-only continuation", () => {
    // No browser storage is required; query parameters carry the safe return.
    const url = new URL(createProfessionalLegalRecoveryUrl("/care-team/trainer", "client-invite"), "https://fixture.invalid");
    expect(url.pathname).toBe("/procare-attestation");
    expect(url.searchParams.get("legalOnly")).toBe("true");
    expect(url.searchParams.get("action")).toBe("client-invite");
    expect(url.searchParams.get("returnTo")).toBe("/care-team/trainer");
  });

  test("classifies the interrupted professional action", () => {
    expect(inferProfessionalLegalAction(
      "https://app.example/api/care-team/invite",
      "POST",
    )).toBe("client-invite");
    expect(inferProfessionalLegalAction(
      "https://app.example/api/studios",
      "POST",
    )).toBe("studio-creation");
    expect(inferProfessionalLegalAction(
      "https://app.example/api/pro/clients",
      "GET",
    )).toBe("professional-workspace");
  });
});