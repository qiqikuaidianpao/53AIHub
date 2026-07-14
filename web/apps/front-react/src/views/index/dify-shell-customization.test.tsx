import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MdRenderer from "../../../../../packages/hub-ui-x-react/packages/components/Markdown/renderer";

import { buildIndexSidebarNavItems } from "./IndexSidebar";

function createShortcut(overrides: Record<string, unknown> = {}) {
  return {
    agent_usage: 0,
    agent_id: "9",
    agent_name: "财税政策智能问答助手",
    agent_description: "Dify shell agent",
    agent_logo: "/agent/tax.png",
    is_pinned: false,
    last_message_content: "",
    last_message_time: 0,
    ...overrides,
  } as any;
}

describe("Dify shell customizations", () => {
  it("renders markdown soft line breaks as visible br elements", () => {
    const { container } = render(<MdRenderer content={"字段一\n字段二"} />);

    const markdownBody = container.querySelector(".markdown-body");
    expect(markdownBody?.querySelector("br")).not.toBeNull();
    expect(markdownBody?.textContent).toBe("字段一字段二");
  });

  it("keeps Excel formulas readable in dark code blocks", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    try {
      const { container } = render(
        <MdRenderer
          content={'```excel\n=B1 - A1\n```\n\n```excel\n=DATEDIF(A1, B1, "d")\n```'}
        />,
      );

      const markdownBody = container.querySelector(".markdown-body");
      await waitFor(() => expect(markdownBody).toHaveClass("dark-mode"));

      const formulas = Array.from(
        container.querySelectorAll<HTMLElement>(
          ".x-code-diagram-viewer__code-pre",
        ),
      );
      expect(formulas.map((formula) => formula.textContent?.trim())).toEqual([
        "=B1 - A1",
        '=DATEDIF(A1, B1, "d")',
      ]);
      expect(formulas).toHaveLength(2);
      formulas.forEach((formula) => {
        expect(formula).toHaveStyle({
          color: "#f3f4f6",
          backgroundColor: "#2d2d2d",
        });
      });
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("does not inject workbench or AI-search fixed entries without backend shortcuts", () => {
    const navItems = buildIndexSidebarNavItems([], true, true);

    expect(navItems).toEqual([]);
    expect(navItems.map((item) => item.label)).not.toContain("小助理");
    expect(navItems.map((item) => item.label)).not.toContain("AI搜问");
  });

  it("keeps real Dify shell shortcuts routed to the agent entry", () => {
    const navItems = buildIndexSidebarNavItems([createShortcut()], true, true);

    expect(navItems).toHaveLength(1);
    expect(navItems[0]).toMatchObject({
      path: "/index/agent?agent_id=9",
      label: "财税政策智能问答助手",
      isFixed: false,
    });
  });
});
