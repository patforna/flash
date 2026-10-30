// To do:
// [x] writes "flash", hidden from assistive tech
import { configure, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./Wordmark";

configure({ reactStrictMode: true });

describe("Wordmark", () => {
  it('writes "flash", hidden from assistive tech', () => {
    const { container } = render(<Wordmark />);
    const mark = container.firstElementChild;
    expect(mark?.textContent).toBe("flash");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });
});
