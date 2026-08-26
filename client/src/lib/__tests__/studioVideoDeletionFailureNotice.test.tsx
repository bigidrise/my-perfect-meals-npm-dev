/**
 * @jest-environment jsdom
 */

import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudioVideoDeletionFailureNotice from "@/components/pro/StudioVideoDeletionFailureNotice";

const originalFetch = globalThis.fetch;

function VideoDeleteHarness() {
  const [mediaState, setMediaState] = useState<"ready" | "deletion_failed" | "deleted">("ready");
  const [error, setError] = useState<string | undefined>();

  const deleteVideo = async () => {
    const response = await fetch("/api/client/tablet/video/message-1", { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json() as {
        error: string;
        retryable?: boolean;
        mediaState?: string;
      };
      if (payload.retryable && payload.mediaState === "deletion_failed") {
        setMediaState("deletion_failed");
        setError(payload.error);
      }
      return;
    }
    setMediaState("deleted");
    setError(undefined);
  };

  if (mediaState === "deleted") {
    return <p data-testid="video-deleted">Video deleted</p>;
  }
  if (mediaState === "deletion_failed") {
    return (
      <StudioVideoDeletionFailureNotice
        error={error}
        isRetrying={false}
        onRetry={deleteVideo}
      />
    );
  }
  return <button onClick={deleteVideo}>Delete private video</button>;
}

describe("StudioVideoDeletionFailureNotice", () => {
  afterEach(() => {
    if (originalFetch) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  it("keeps a server-persisted finalization failure visible and allows an in-place retry", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "Video could not be deleted. Please try again.",
          retryable: true,
          mediaState: "deletion_failed",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    render(<VideoDeleteHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Delete private video" }));
    expect(await screen.findByTestId("studio-video-delete-retry")).toHaveTextContent(
      "Video could not be deleted. Please try again.",
    );
    expect(screen.getByTestId("retry-studio-video-delete")).toBeEnabled();

    fireEvent.click(screen.getByTestId("retry-studio-video-delete"));
    await waitFor(() => expect(screen.getByTestId("video-deleted")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});