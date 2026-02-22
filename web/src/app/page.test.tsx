import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// The Home page is an async Server Component, so we resolve it before rendering
import Home from "./page";

describe("Home page", () => {
  it("renders the Sport Predictor heading", async () => {
    const Component = await Home();
    render(Component);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sport Predictor");
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
});
