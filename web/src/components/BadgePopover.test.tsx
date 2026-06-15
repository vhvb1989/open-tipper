import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BadgePopover from "./BadgePopover";

describe("BadgePopover", () => {
  const defaultProps = {
    badge: <span>ES</span>,
    title: "Exact Score",
    description: "You predicted the exact final score of the match.",
    points: "+10 pts",
  };

  it("renders the badge content", () => {
    render(<BadgePopover {...defaultProps} />);
    expect(screen.getByText("ES")).toBeDefined();
  });

  it("does not show popover by default", () => {
    render(<BadgePopover {...defaultProps} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens popover on click", () => {
    render(<BadgePopover {...defaultProps} />);
    fireEvent.click(screen.getByText("ES"));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Exact Score")).toBeDefined();
    expect(screen.getByText("You predicted the exact final score of the match.")).toBeDefined();
    expect(screen.getByText("+10 pts")).toBeDefined();
  });

  it("closes popover when clicking outside", () => {
    render(
      <div>
        <BadgePopover {...defaultProps} />
        <span data-testid="outside">outside</span>
      </div>,
    );
    fireEvent.click(screen.getByText("ES"));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes popover on Escape key", () => {
    render(<BadgePopover {...defaultProps} />);
    fireEvent.click(screen.getByText("ES"));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes popover when clicking the close button", () => {
    render(<BadgePopover {...defaultProps} />);
    fireEvent.click(screen.getByText("ES"));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders without points when not provided", () => {
    const propsWithoutPoints = {
      badge: defaultProps.badge,
      title: defaultProps.title,
      description: defaultProps.description,
    };
    render(<BadgePopover {...propsWithoutPoints} />);
    fireEvent.click(screen.getByText("ES"));
    expect(screen.getByText("Exact Score")).toBeDefined();
    expect(screen.queryByText("+10 pts")).toBeNull();
  });

  it("toggles popover on repeated clicks", () => {
    render(<BadgePopover {...defaultProps} />);
    const badge = screen.getByText("ES");

    fireEvent.click(badge);
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(badge);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sets correct aria attributes on trigger", () => {
    render(<BadgePopover {...defaultProps} />);
    const trigger = screen.getByRole("button");

    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});
