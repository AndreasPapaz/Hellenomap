// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsList } from "@/components/map/ResultsList";
import type { BusinessInView } from "@/lib/directory";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const item = (slug: string, distance_m: number, category: string | null = "Deli"): BusinessInView => ({
  id: slug,
  slug,
  name: slug.toUpperCase(),
  address: "x",
  phone: null,
  website: null,
  lat: 0,
  lng: 0,
  distance_m,
  primary_category_slug: category?.toLowerCase() ?? null,
  primary_category_name: category,
  group_slug: "food-dining",
  category_slugs_all: [],
} as BusinessInView);

describe("ResultsList", () => {
  it("renders items in the given (distance) order with name, category and distance", () => {
    render(
      <ResultsList
        items={[item("near", 804.672), item("mid", 4828.032, "Lawyer"), item("far", 19312.128, null)]}
        selected={null}
        loading={false}
        onSelect={() => {}}
      />,
    );
    const rows = screen.getAllByTestId("result-item");
    expect(rows.map((r) => r.textContent)).toEqual(["NEARDeli0.5 mi", "MIDLawyer3.0 mi", "FAROther12 mi"]);
  });

  it("calls onSelect and marks the selected item", () => {
    const onSelect = vi.fn();
    render(<ResultsList items={[item("a", 1), item("b", 2)]} selected="b" loading={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("A"));
    expect(onSelect).toHaveBeenCalledWith("a");
    expect(screen.getAllByTestId("result-item")[1].getAttribute("aria-current")).toBe("true");
  });

  it("shows an empty state that links to the submission form", () => {
    render(<ResultsList items={[]} selected={null} loading={false} onSelect={() => {}} />);
    expect(screen.getByTestId("results-empty").textContent).toContain("Try zooming out");
    expect(screen.getByRole("link", { name: "Submit a business" }).getAttribute("href")).toBe("/submit");
  });

  it("does not show the empty state while loading", () => {
    render(<ResultsList items={[]} selected={null} loading onSelect={() => {}} />);
    expect(screen.queryByTestId("results-empty")).toBeNull();
  });
});
