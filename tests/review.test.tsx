import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GDGoCIntro from "../src/components/intro/GDGoCIntro";
import Profile from "../src/components/Profile";

beforeEach(() => {
  sessionStorage.clear();
  location.hash = "";
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })),
  );
});

afterEach(cleanup);

test("intro makes the page behind it inert and keeps Tab inside", () => {
  const { unmount } = render(
    <div>
      <button type="button">Behind the intro</button>
      <GDGoCIntro />
    </div>,
  );

  const behind = screen.getByText("Behind the intro");
  const skip = screen.getByRole("button", { name: /skip intro/i });

  expect(behind.inert).toBe(true);
  expect(document.activeElement).toBe(skip);

  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(skip);

  unmount();
  expect(behind.inert).toBe(false);
});

test("profile load failure offers a retry that works", async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(new Response("{}", { status: 500 })))
    .mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ name: "Asha Verma", email: "a@psit.ac.in" }), { status: 200 })),
    );
  vi.stubGlobal("fetch", fetchMock);

  render(<Profile />);
  fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

  expect(await screen.findAllByText("Asha Verma")).not.toHaveLength(0);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
