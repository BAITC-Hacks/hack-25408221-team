import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProctor } from "@/features/english/hooks/useProctor";
import { ProctorResources } from "@/features/english/types";

const { sendProctorEvents, detect } = vi.hoisted(() => ({
  sendProctorEvents: vi.fn(),
  detect: vi.fn(),
}));

vi.mock("@/features/english/api/endpoints", () => ({
  sendProctorEvents,
}));

vi.mock("@/features/english/hooks/useFaceDetector", () => ({
  getFaceDetector: async () => ({ detectForVideo: detect }),
  withDetectorLogging: (run: () => unknown) => run(),
}));

let displays: EventTarget & { screens: unknown[] };
let resources: ProctorResources;

beforeEach(() => {
  vi.useFakeTimers();
  sendProctorEvents.mockReset().mockResolvedValue({});
  detect.mockReset().mockReturnValue({ detections: [{}] });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: document.documentElement,
  });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get: () => 4,
  });
  displays = Object.assign(new EventTarget(), { screens: [{}] });
  const stream = {
    getTracks: () => [{ readyState: "live", muted: false }],
    getVideoTracks: () => [{ readyState: "live", muted: false }],
  } as unknown as MediaStream;
  resources = { camera: stream, screen: stream, displays };
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("continuous proctoring", () => {
  it("blocks app switching immediately and clears on focus", async () => {
    const { result } = renderHook(() =>
      useProctor("s", "reading", true, resources)
    );
    await act(async () => {});
    act(() => window.dispatchEvent(new Event("blur")));
    expect(result.current.reasons).toContain("Return to the test window");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(
      sendProctorEvents.mock.calls.some(([, events]) =>
        events.some((e: { type: string }) => e.type === "window_blur")
      )
    ).toBe(true);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.reasons).not.toContain("Return to the test window");
  });

  it("blocks when another monitor is attached", async () => {
    const { result } = renderHook(() =>
      useProctor("s", "reading", true, resources)
    );
    await act(async () => {});
    act(() => {
      displays.screens = [{}, {}];
      displays.dispatchEvent(new Event("screenschange"));
    });
    expect(result.current.reasons).toContain(
      "Disconnect the additional display"
    );
  });

  it("blocks sustained face absence but tolerates brief detection misses", async () => {
    const { result } = renderHook(() =>
      useProctor("s", "reading", true, resources)
    );
    await act(async () => {});
    detect.mockReturnValue({ detections: [] });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.reasons).not.toContain(
      "Keep your face visible to the camera"
    );
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(result.current.reasons).toContain(
      "Keep your face visible to the camera"
    );
  });

  it("sends periodic heartbeat and removes listeners on unmount", async () => {
    const { unmount } = renderHook(() =>
      useProctor("s", "reading", true, resources)
    );
    await act(async () => vi.advanceTimersByTimeAsync(21000));
    expect(
      sendProctorEvents.mock.calls
        .flatMap(([, events]) => events)
        .filter((e) => e.type === "heartbeat").length
    ).toBeGreaterThanOrEqual(2);
    unmount();
    const calls = sendProctorEvents.mock.calls.length;
    act(() => window.dispatchEvent(new Event("blur")));
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(sendProctorEvents.mock.calls.length).toBe(calls);
  });

  it("retains and retries unsent events after a network error", async () => {
    sendProctorEvents.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useProctor("s", "reading", true, resources)
    );
    await act(async () => {});
    expect(result.current.networkOk).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.networkOk).toBe(true);
  });
});
