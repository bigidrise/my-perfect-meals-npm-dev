import {
  inferProfessionalLegalAction,
  safeProfessionalReturnTo,
} from "../../client/src/lib/professionalLegalRecovery";

describe("professional legal recovery routing", () => {
  test("preserves safe same-origin destinations", () => {
    expect(safeProfessionalReturnTo("/care-team/trainer?invite=1"))
      .toBe("/care-team/trainer?invite=1");
    expect(safeProfessionalReturnTo("//example.com")).toBeNull();
    expect(safeProfessionalReturnTo("https://example.com")).toBeNull();
    expect(safeProfessionalReturnTo("/auth?returnTo=/care-team")).toBeNull();
    expect(safeProfessionalReturnTo("/procare-attestation")).toBeNull();
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