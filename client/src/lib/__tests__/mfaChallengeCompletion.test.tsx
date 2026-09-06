/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { MfaChallengeModal } from "@/components/MfaChallengeModal";
import { completeMfaChallenge } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  completeMfaChallenge: jest.fn(),
}));

const mockedCompleteMfaChallenge = completeMfaChallenge as jest.MockedFunction<
  typeof completeMfaChallenge
>;

describe("MFA challenge completion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps verification locked until post-login navigation completes", async () => {
    let finishPostLogin!: () => void;
    const postLogin = new Promise<void>((resolve) => {
      finishPostLogin = resolve;
    });
    const user = { id: "founder-user", email: "founder@example.com" } as any;
    mockedCompleteMfaChallenge.mockResolvedValue(user);
    const onSuccess = jest.fn(() => postLogin);

    render(
      <MfaChallengeModal onSuccess={onSuccess} onCancel={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText("000 000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(
      (await screen.findByRole("button", { name: "Verifying…" })) as HTMLButtonElement,
    ).toHaveProperty("disabled", true);
    expect(onSuccess).toHaveBeenCalledWith(user);

    fireEvent.click(screen.getByRole("button", { name: "Verifying…" }));
    expect(mockedCompleteMfaChallenge).toHaveBeenCalledTimes(1);

    finishPostLogin();
    expect(
      (await screen.findByRole("button", { name: "Verify" })) as HTMLButtonElement,
    ).toHaveProperty("disabled", false);
  });
});