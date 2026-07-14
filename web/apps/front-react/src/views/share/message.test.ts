import { describe, expect, it } from "vitest";

import { parseSharedUserContent } from "./message";

describe("parseSharedUserContent", () => {
  it("keeps image and document attachments with the shared question", () => {
    const message = JSON.stringify([
      {
        role: "user",
        content: JSON.stringify([
          { type: "text", content: "Summarize this file" },
          {
            id: "image-id",
            type: "image",
            filename: "report.png",
            size: 258708,
            mime_type: "image/png",
            url: "/api/preview/report.png",
          },
          {
            id: "file-id",
            type: "image",
            filename: "report.xlsx",
            size: 16069,
            mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            url: "/api/preview/report.xlsx",
          },
        ]),
      },
    ]);

    const result = parseSharedUserContent(message);

    expect(result.question).toBe("Summarize this file");
    expect(result.files).toEqual([
      expect.objectContaining({ filename: "report.png", mime_type: "image/png" }),
      expect.objectContaining({ filename: "report.xlsx" }),
    ]);
  });

  it("keeps legacy plain-text questions compatible", () => {
    const message = JSON.stringify([{ role: "user", content: "Plain question" }]);

    expect(parseSharedUserContent(message)).toEqual({
      question: "Plain question",
      files: [],
    });
  });
});
