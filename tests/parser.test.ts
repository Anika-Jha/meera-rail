import { describe, expect, it } from "vitest";
import { parseNotice, ParseError } from "../src/parser.js";

describe("MeeraRail parser", () => {
  it("parses a valid railway notice", () => {
    const result = parseNotice(
      "Train 12951 at PUNE: Expected at 18:45. Delay due to heavy rain."
    );

    expect(result).toEqual({
      train: "12951",
      station: "PUNE",
      expectedTime: "18:45",
      reason: "heavy rain",
    });
  });

  it("parses a notice without a reason", () => {
    const result = parseNotice(
      "Train 12124 at MUMBAI: Expected at 19:30."
    );

    expect(result).toEqual({
      train: "12124",
      station: "MUMBAI",
      expectedTime: "19:30",
      reason: null,
    });
  });

  it("rejects malformed notices", () => {
    expect(() =>
      parseNotice("asdf qwerty this is not a railway notice")
    ).toThrow(ParseError);
  });

  it("rejects notices without a train number", () => {
    expect(() =>
      parseNotice("PUNE station: Expected at 18:45.")
    ).toThrow(ParseError);
  });

  it("rejects notices without an expected time", () => {
    expect(() =>
      parseNotice("Train 12951 at PUNE. Delay due to rain.")
    ).toThrow(ParseError);
  });

  it("rejects oversized input", () => {
    expect(() =>
      parseNotice("Train 12951 at PUNE: Expected at 18:45. " + "x".repeat(5000))
    ).toThrow(ParseError);
  });
});