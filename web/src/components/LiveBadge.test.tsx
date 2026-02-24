import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveBadge } from "./LiveBadge";

describe("LiveBadge", () => {
  it("renders LIVE badge for IN_PLAY status", () => {
    render(<LiveBadge status="IN_PLAY" />);
    expect(screen.getByText("Live")).toBeDefined();
  });

  it("renders HT badge for PAUSED status", () => {
    render(<LiveBadge status="PAUSED" />);
    expect(screen.getByText("HT")).toBeDefined();
  });

  it("renders nothing for FINISHED status", () => {
    const { container } = render(<LiveBadge status="FINISHED" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for SCHEDULED status", () => {
    const { container } = render(<LiveBadge status="SCHEDULED" />);
    expect(container.innerHTML).toBe("");
  });

  it("has pulsing animation for IN_PLAY", () => {
    const { container } = render(<LiveBadge status="IN_PLAY" />);
    const pulsingEl = container.querySelector(".animate-ping");
    expect(pulsingEl).toBeDefined();
    expect(pulsingEl).not.toBeNull();
  });
});
