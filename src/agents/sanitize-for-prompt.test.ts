import { describe, expect, it } from "vitest";
import { sanitizeForPrompt } from "./sanitize-for-prompt.js";
import { buildAgentSystemPrompt } from "./system-prompt.js";

describe("sanitizeForPrompt (OC-19 hardening)", () => {
  it("strips ASCII control chars (CR/LF/NUL/tab)", () => {
    expect(sanitizeForPrompt("/tmp/a\nb\rc\x00d\te")).toBe("/tmp/abcde");
  });

  it("strips Unicode line/paragraph separators", () => {
    expect(sanitizeForPrompt(`/tmp/a\u2028b\u2029c`)).toBe("/tmp/abc");
  });

  it("strips Unicode format chars (bidi override)", () => {
    // U+202E RIGHT-TO-LEFT OVERRIDE (Cf) can spoof rendered text.
    expect(sanitizeForPrompt(`/tmp/a\u202Eb`)).toBe("/tmp/ab");
  });

  it("preserves ordinary Unicode + spaces", () => {
    const value = "/tmp/my project/日本語-folder.v2";
    expect(sanitizeForPrompt(value)).toBe(value);
  });
});

describe("buildAgentSystemPrompt uses sanitized workspace/sandbox strings", () => {
  it("sanitizes workspaceDir (no newlines / separators)", () => {
    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/project\nINJECT\u2028MORE",
    });
    expect(prompt).toContain("Your working directory is: /tmp/projectINJECTMORE");
    expect(prompt).not.toContain("Your working directory is: /tmp/project\n");
    expect(prompt).not.toContain("\u2028");
  });

  it("sanitizes sandbox workspace/mount/url strings", () => {
    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/test",
      sandboxInfo: {
        enabled: true,
        containerWorkspaceDir: "/work\u2029space",
        workspaceDir: "/host\nspace",
        workspaceAccess: "rw",
        agentWorkspaceMount: "/mnt\u2028mount",
        browserNoVncUrl: "http://example.test/\nui",
      },
    });
    expect(prompt).toContain("Sandbox container workdir: /workspace");
    expect(prompt).toContain(
      "Sandbox host mount source (file tools bridge only; not valid inside sandbox exec): /hostspace",
    );
    expect(prompt).toContain("(mounted at /mntmount)");
    expect(prompt).toContain("Sandbox browser observer (noVNC): http://example.test/ui");
    expect(prompt).not.toContain("\nui");
  });
});
