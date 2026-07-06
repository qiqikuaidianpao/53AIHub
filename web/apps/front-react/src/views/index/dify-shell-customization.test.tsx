import { render } from "@testing-library/react";
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
