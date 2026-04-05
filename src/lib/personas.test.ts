import { describe, expect, it } from "vitest";
import { parsePersonasJson } from "./personas";

describe("parsePersonasJson", () => {
  it("test_parsePersonasJson_valid_returns_list", () => {
    const raw = [
      {
        id: "a",
        name: "A",
        cwd: "/tmp",
        cmd: "npx",
        cmdArgs: ["x"],
        args: [],
        taskFile: "/tmp/t.json",
        color: "#fff",
      },
    ];
    const r = parsePersonasJson(raw);
    expect(r).toHaveLength(1);
    expect(r?.[0]?.id).toBe("a");
  });

  it("test_parsePersonasJson_empty_array_returns_null", () => {
    expect(parsePersonasJson([])).toBeNull();
  });

  it("test_parsePersonasJson_malformed_returns_null", () => {
    expect(parsePersonasJson([{ id: "" }])).toBeNull();
    expect(parsePersonasJson(null)).toBeNull();
    expect(parsePersonasJson({})).toBeNull();
  });

  it("test_parsePersonasJson_stream_options_optional", () => {
    const raw = [
      {
        id: "a",
        name: "A",
        cwd: "/tmp",
        cmd: "npx",
        cmdArgs: ["x"],
        args: [],
        taskFile: "/tmp/t.json",
        color: "#fff",
        streamBare: true,
        streamExtraArgs: ["--model", "opus"],
        permissionMode: "acceptEdits",
        allowedTools: "Read,Bash",
      },
    ];
    const r = parsePersonasJson(raw);
    expect(r?.[0]?.streamBare).toBe(true);
    expect(r?.[0]?.streamExtraArgs).toEqual(["--model", "opus"]);
    expect(r?.[0]?.permissionMode).toBe("acceptEdits");
    expect(r?.[0]?.allowedTools).toBe("Read,Bash");
  });

  it("test_parsePersonasJson_browse_roots_optional", () => {
    const raw = [
      {
        id: "a",
        name: "A",
        cwd: "/tmp",
        cmd: "npx",
        cmdArgs: ["x"],
        args: [],
        taskFile: "/tmp/t.json",
        color: "#fff",
        browseRoots: [{ label: "L", path: "/tmp" }],
      },
    ];
    const r = parsePersonasJson(raw);
    expect(r?.[0]?.browseRoots).toEqual([{ label: "L", path: "/tmp" }]);
  });
});
