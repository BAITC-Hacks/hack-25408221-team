import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ObjectiveSection } from "@/features/english/components/ObjectiveSection";
import { WritingSection } from "@/features/english/components/WritingSection";

vi.mock("@/features/english/api/endpoints", () => ({
  getMediaUrl: (p: string) => `http://localhost:8000/media/${p}`,
  getDefaultApiUrl: () => "http://localhost:8000",
}));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

it("shows the reading passage and saves the current answer on expiry", () => {
  const submit = vi.fn();
  render(
    <ObjectiveSection
      section="reading"
      items={[
        {
          id: "r1",
          type: "passage",
          cefr: 3,
          text: "A student visits the library on Monday.",
          questions: [{ id: "q1", type: "gap", prompt: "Which day?" }],
        },
      ]}
      submitting={false}
      onSubmit={submit}
    />
  );
  expect(
    screen.getByText("A student visits the library on Monday.")
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Monday" },
  });
  fireEvent(window, new Event("assessment-expired"));
  expect(submit).toHaveBeenCalledWith([
    { item_id: "r1", answer: { q1: "Monday" } },
  ]);
});

it("restores a writing draft across a device recheck", () => {
  const props = {
    item: {
      id: "w1",
      type: "opinion",
      cefr: 3,
      prompt: "Describe your study routine.",
    },
    submitting: false,
    onSubmit: vi.fn(),
  };
  const first = render(<WritingSection {...props} />);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "I study with my classmates." },
  });
  first.unmount();
  render(<WritingSection {...props} />);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
    "I study with my classmates."
  );
});

it("provides an explicit listening play control with a real audio URL", () => {
  const { container } = render(
    <ObjectiveSection
      section="listening"
      items={[{ id: "l1", type: "clip", cefr: 3, audio: "listening/l1.wav" }]}
      submitting={false}
      onSubmit={vi.fn()}
    />
  );
  expect(screen.getByRole("button", { name: /Play Audio/i })).toBeTruthy();
  expect(container.querySelector("audio")?.getAttribute("src")).toBe(
    "http://localhost:8000/media/listening/l1.wav"
  );
});
