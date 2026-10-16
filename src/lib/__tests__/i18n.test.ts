import { describe, expect, it } from "vitest";
import { DICTS } from "../i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const { en, ...others } = DICTS;

  for (const [lang, dict] of Object.entries(others)) {
    it(`${lang} has every key and nothing extra`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    });

    it(`${lang} keeps the same {placeholders} as English`, () => {
      const mismatched = Object.entries(en)
        .filter(([key, text]) => placeholders(text).join() !== placeholders(dict[key as keyof typeof en]).join())
        .map(([key]) => key);
      expect(mismatched).toEqual([]);
    });

    it(`${lang} has no empty strings`, () => {
      expect(Object.entries(dict).filter(([, v]) => !v.trim())).toEqual([]);
    });
  }
});
