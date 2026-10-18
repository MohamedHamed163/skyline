import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeLocation, makeProperty } from "@/test/fixtures";
import ar from "@/lib/i18n/ar";
import { DictProvider } from "@/lib/i18n/client";
import en, { type Dict } from "@/lib/i18n/en";
import { CODE_PATTERN } from "@/lib/property-codes";
import type { Property, Purpose } from "@/lib/types";
import { PropertyFields } from "./property-fields";

// The Rental code field of the property forms (docs/rental-codes.md), as static HTML. Switching
// Purpose needs a browser; it only flips the fieldset's hidden/disabled attributes checked here.

const TODAY = "2026-10-13";

const render = (o: { admin?: boolean; defaultPurpose?: Purpose; defaults?: Property; dict?: Dict } = {}) =>
  renderToStaticMarkup(
    h(DictProvider, {
      dict: o.dict ?? en,
      children: h(PropertyFields, { locations: [makeLocation()], admin: o.admin, defaultPurpose: o.defaultPurpose, defaults: o.defaults, today: TODAY }),
    }),
  );

/** The fieldset holding the code input, from its opening tag to the input itself. */
const codeField = (html: string) => html.match(/<fieldset[^>]*>(?:(?!<fieldset)[\s\S])*?<input[^>]*name="code"[^>]*>/)?.[0];

describe("Rental code field", () => {
  it("asks for the code when the admin adds a rental", () => {
    const field = codeField(render({ admin: true, defaultPurpose: "rent" }));
    expect(field).toBeDefined();
    expect(field).not.toMatch(/<fieldset[^>]*(hidden|disabled)/);
    expect(field).toContain("Rental code");
    expect(field).toMatch(/<input[^>]*required/);
    expect(field).toContain(`pattern="${CODE_PATTERN}"`);
    expect(field).toContain('maxLength="10"');
    expect(field).toContain('placeholder="e.g. A101 or شاليه-٥"');
    // Arabic codes read right to left, English ones left to right.
    expect(field).toContain('dir="auto"');
  });

  it("explains the rules under the field", () => {
    expect(render({ admin: true, defaultPurpose: "rent" })).toContain(
      "Shown on the listing and in its web address. Up to 10 letters (English or Arabic), numbers and dashes. It can&#x27;t be changed later.",
    );
  });

  it("is hidden and disabled while the new listing is a sale, so it is neither sent nor required", () => {
    const field = codeField(render({ admin: true, defaultPurpose: "sale" }));
    expect(field).toMatch(/<fieldset[^>]*disabled/);
    expect(field).toMatch(/<fieldset[^>]*hidden/);
  });

  it("isn't on the edit form, so an existing listing's code can't change", () => {
    expect(render({ admin: true, defaults: makeProperty({ purpose: "rent", code: "VILLA12" }) })).not.toContain('name="code"');
  });

  it("isn't on the public submission form", () => {
    expect(render({ admin: false })).not.toContain('name="code"');
  });

  it("is translated in Arabic, with the code's direction following what is typed", () => {
    const field = codeField(render({ admin: true, defaultPurpose: "rent", dict: ar }));
    expect(field).toContain("كود الوحدة");
    expect(field).toContain("حتى 10 أحرف أو أرقام (عربية أو إنجليزية) وشرطات");
    expect(field).toContain('placeholder="مثل شاليه-٥ أو A101"');
    expect(field).toContain('dir="auto"');
  });
});
