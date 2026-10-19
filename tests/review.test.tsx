import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Profile from "../src/components/Profile";
import MemberCard from "../src/components/MemberCard";

const MEMBER = {
  name: "Asha Verma",
  email: "a@psit.ac.in",
  branch: "IT",
  year: 2,
  createdAt: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
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

test("profile load failure offers a retry that works", async () => {
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(new Response("{}", { status: 500 })))
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(MEMBER), { status: 200 })));
  vi.stubGlobal("fetch", fetchMock);

  render(<Profile />);
  fireEvent.click(await screen.findByRole("button", { name: /try again/i }));

  expect(await screen.findByRole("figure", { name: /member card for asha verma/i })).toBeTruthy();
  const profileRequests = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/users/me"));
  expect(profileRequests).toHaveLength(2);
});

test("member card shows the member and their details", () => {
  render(<MemberCard user={MEMBER} />);

  expect(screen.getByRole("figure", { name: /member card for asha verma/i })).toBeTruthy();
  expect(screen.getByText("IT · Year 2")).toBeTruthy();
  expect(screen.getByText(/member since/i)).toBeTruthy();
  expect(screen.queryByText(/upcoming/i)).toBeNull();
});

test("member card shows live counts when they are provided", () => {
  render(<MemberCard user={MEMBER} upcoming={3} attended={1} />);

  expect(screen.getByRole("link", { name: /3\s*upcoming/i }).getAttribute("href")).toBe("#/tickets");
  expect(screen.getByRole("link", { name: /1\s*attended/i })).toBeTruthy();
});
