import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// The Home page is an async Server Component, so we resolve it before rendering
import Home from "./page";

describe("Home page", () => {
  it("renders the Open Tipper heading", async () => {
    const Component = await Home();
    render(Component);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Open Tipper");
  });

  it("renders the tagline", async () => {
    const Component = await Home();
    render(Component);
    expect(screen.getByText(/score prediction with your mates/i)).toBeDefined();
  });

  it("shows Get started link when not authenticated", async () => {
    const Component = await Home();
    render(Component);
    expect(screen.getByRole("link", { name: /get started/i })).toBeDefined();
  });

  it("shows How it works link when not authenticated", async () => {
    const Component = await Home();
    render(Component);
    const links = screen.getAllByRole("link", { name: /how it works/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the features section", async () => {
    const Component = await Home();
    render(Component);
    expect(screen.getByText("Everything you need to compete")).toBeDefined();
    expect(screen.getByText("Predict Scores")).toBeDefined();
    expect(screen.getByText("Create Groups")).toBeDefined();
    expect(screen.getByText("Climb Leaderboards")).toBeDefined();
  });
});
