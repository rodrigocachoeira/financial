import { describe, expect, it } from "vitest";
import { isAllowedEmail, isPublicPath } from "./access";

describe("isAllowedEmail", () => {
  const allowed = "owner@example.com";

  it.each(["owner@example.com", "Owner@Example.COM", "  owner@example.com "])("accepts %j", (email) => {
    expect(isAllowedEmail(email, true, allowed)).toBe(true);
  });

  it("ignores case and spaces in the configured address", () => {
    expect(isAllowedEmail("owner@example.com", true, " OWNER@example.com ")).toBe(true);
  });

  it.each(["other@example.com", "owner@example.com.evil.com", "", null, undefined])("rejects %j", (email) => {
    expect(isAllowedEmail(email, true, allowed)).toBe(false);
  });

  it("rejects an unverified address", () => {
    expect(isAllowedEmail(allowed, false, allowed)).toBe(false);
  });

  it.each([undefined, "", "   "])("rejects everyone when the allowed address is %j", (configured) => {
    expect(isAllowedEmail(allowed, true, configured)).toBe(false);
    expect(isAllowedEmail("", true, configured)).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/auth",
    "/api/auth/session",
    "/api/auth/callback/google",
    "/_next/static/x.js",
    "/favicon.ico",
  ])("is public: %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each(["/", "/api/imports", "/loginx", "/login/extra", "/api/authx", "/api", "/_nextx", "/reports"])(
    "is protected: %s",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});
