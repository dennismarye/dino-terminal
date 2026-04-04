import { describe, expect, it } from "vitest";
import { parseTasksFile } from "./useTasks";

describe("parseTasksFile", () => {
  it("test_parseTasksFile_array_maps_status", () => {
    const { rows } = parseTasksFile([
      { id: "1", content: "Fix auth", status: "in_progress" },
      { id: "2", title: "Ship", status: "completed" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("in_progress");
    expect(rows[1].status).toBe("completed");
  });

  it("test_parseTasksFile_wraps_tasks_property", () => {
    const { rows } = parseTasksFile({
      tasks: [{ content: "One", status: "pending" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("One");
  });

  it("test_parseTasksFile_in_progress_hyphen", () => {
    const { rows } = parseTasksFile([
      { id: "a", title: "T", status: "in-progress" },
    ]);
    expect(rows[0].status).toBe("in_progress");
  });

  it("test_parseTasksFile_parked_and_blocked", () => {
    const { rows } = parseTasksFile([
      { id: "1", title: "Parked task", status: "parked" },
      { id: "2", title: "Blocked task", status: "blocked" },
    ]);
    expect(rows[0].status).toBe("parked");
    expect(rows[1].status).toBe("blocked");
  });

  it("test_parseTasksFile_moreCount_when_over_cap", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      title: `Task ${i}`,
      status: "pending",
    }));
    const { rows, moreCount } = parseTasksFile({ tasks });
    expect(rows).toHaveLength(10);
    expect(moreCount).toBe(2);
  });
});
