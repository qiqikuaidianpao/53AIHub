import { createEvent, fireEvent, render, waitFor } from "@testing-library/react";
import { Sender } from "@km/hub-ui-x-react";
import { vi } from "vitest";

function createDataTransfer(files: File[] = [], types: string[] = ["Files"]) {
  return {
    files,
    types,
    dropEffect: "none",
  } as unknown as DataTransfer;
}

describe("Hub Sender drag upload", () => {
  it("prevents browser navigation and uploads dropped files", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const httpRequest = vi.fn().mockResolvedValue({ id: "file-1", url: "/files/file-1" });
    const { container } = render(
      <Sender
        enableUpload
        enableDragUpload
        allowMultiple
        httpRequest={httpRequest}
      />,
    );
    const sender = container.querySelector(".x-sender") as HTMLElement;
    const dataTransfer = createDataTransfer([file]);

    const dragOver = createEvent.dragOver(sender, { dataTransfer });
    fireEvent(sender, dragOver);

    expect(dragOver.defaultPrevented).toBe(true);
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(container.querySelector(".x-sender__drag-overlay")).toBeInTheDocument();

    const drop = createEvent.drop(sender, { dataTransfer });
    fireEvent(sender, drop);

    expect(drop.defaultPrevented).toBe(true);
    await waitFor(() => expect(httpRequest).toHaveBeenCalledWith(file));
    expect(container.querySelector(".x-sender__drag-overlay")).not.toBeInTheDocument();
  });

  it("still prevents browser navigation when uploading is disabled", () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const httpRequest = vi.fn();
    const { container } = render(
      <Sender disabled enableDragUpload httpRequest={httpRequest} />,
    );
    const sender = container.querySelector(".x-sender") as HTMLElement;
    const drop = createEvent.drop(sender, {
      dataTransfer: createDataTransfer([file]),
    });

    fireEvent(sender, drop);

    expect(drop.defaultPrevented).toBe(true);
    expect(httpRequest).not.toHaveBeenCalled();
  });

  it("does not intercept non-file drags", () => {
    const { container } = render(<Sender enableDragUpload />);
    const sender = container.querySelector(".x-sender") as HTMLElement;
    const dragOver = createEvent.dragOver(sender, {
      dataTransfer: createDataTransfer([], ["text/plain"]),
    });

    fireEvent(sender, dragOver);

    expect(dragOver.defaultPrevented).toBe(false);
  });
});
