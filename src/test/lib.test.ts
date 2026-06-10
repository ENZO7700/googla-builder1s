import { describe, it, expect } from "vitest";
import { createWorkflowRun, updateWorkflowStep, finishWorkflowRun } from "../lib/workflow";
import { isAdminEmail } from "../lib/admin";

describe("workflow", () => {
  it("should create workflow run", () => {
    const run = createWorkflowRun("Test Pipeline");
    expect(run.label).toBe("Test Pipeline");
    expect(run.status).toBe("running");
    expect(run.progress).toBe(0);
    expect(run.steps.length).toBe(6);
    expect(run.steps[0].status).toBe("waiting");
  });

  it("should update workflow step status and calculate progress", () => {
    let run = createWorkflowRun();
    
    // Set first step to running
    run = updateWorkflowStep(run, "input", { status: "running", detail: "Reading prompt" });
    expect(run.steps[0].status).toBe("running");
    expect(run.lastEvent).toBe("Reading prompt");
    
    // Set first step to done
    run = updateWorkflowStep(run, "input", { status: "done", detail: "Done input" });
    expect(run.steps[0].status).toBe("done");
    expect(run.progress).toBe(17);
  });

  it("should detect errors", () => {
    let run = createWorkflowRun();
    run = updateWorkflowStep(run, "input", { status: "error", detail: "Error input" });
    expect(run.status).toBe("error");
    expect(run.finishedAt).toBeDefined();
  });

  it("should finish workflow run", () => {
    let run = createWorkflowRun();
    run = finishWorkflowRun(run, "done", "Finished");
    expect(run.status).toBe("done");
    expect(run.progress).toBe(100);
    expect(run.lastEvent).toBe("Finished");
  });
});

describe("admin auth", () => {
  it("should validate admin emails based on whitelist", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    // Since ADMIN_EMAILS starts empty by default:
    expect(isAdminEmail("admin@example.com")).toBe(false);
  });
});
