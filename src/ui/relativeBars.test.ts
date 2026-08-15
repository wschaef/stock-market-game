import { describe, expect, it } from "vitest";
import { relativeBarPercents } from "./relativeBars";

describe("relativeBarPercents", () => {
  it("maps the highest price to 100 and others proportionally", () => {
    expect(
      relativeBarPercents({
        commerzbank: 200,
        bayer: 100,
        bmw: 50,
        bp: 0,
      }),
    ).toEqual({
      commerzbank: 100,
      bayer: 50,
      bmw: 25,
      bp: 0,
    });
  });

  it("gives equal heights when all prices match", () => {
    expect(
      relativeBarPercents({
        commerzbank: 100,
        bayer: 100,
        bmw: 100,
        bp: 100,
      }),
    ).toEqual({
      commerzbank: 100,
      bayer: 100,
      bmw: 100,
      bp: 100,
    });
  });

  it("returns zeros when every price is zero", () => {
    expect(
      relativeBarPercents({
        commerzbank: 0,
        bayer: 0,
        bmw: 0,
        bp: 0,
      }),
    ).toEqual({
      commerzbank: 0,
      bayer: 0,
      bmw: 0,
      bp: 0,
    });
  });
});
