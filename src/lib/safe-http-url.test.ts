import { describe, expect, it } from "vitest";
import { isSafeHttpUrl } from "./safe-http-url";

describe("isSafeHttpUrl", () => {
  it("test_isSafeHttpUrl_accepts_https", () => {
    expect(isSafeHttpUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("test_isSafeHttpUrl_accepts_http", () => {
    expect(isSafeHttpUrl("http://localhost:8080/")).toBe(true);
  });

  it("test_isSafeHttpUrl_rejects_javascript", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("test_isSafeHttpUrl_rejects_file", () => {
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("test_isSafeHttpUrl_rejects_garbage", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
  });
});
