import { describe, expect, it } from "vitest";

import { generateSessionCode } from "./session-code";

describe("generateSessionCode", () => {
  it("creates uppercase 5-character invite codes", () => {
    const code = generateSessionCode();

    expect(code).toMatch(/^[A-Z2-9]{5}$/);
  });

  it("creates different values across calls", () => {
    const first = generateSessionCode();
    const second = generateSessionCode();

    expect(first).not.toBe(second);
  });
});
