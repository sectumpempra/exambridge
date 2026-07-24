import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VectorGeometryLabWorkspace } from "@/pages/vector-geometry-lab/VectorGeometryLabWorkspace";
import { getExample } from "@/pages/vector-geometry-lab/examples/builtin-examples.js";
import { sceneToJson } from "@/pages/vector-geometry-lab/export/json-transfer.js";
import type { DownloadDeps } from "@/pages/vector-geometry-lab/export/download.js";
import type { StorageLike } from "@/pages/vector-geometry-lab/storage/scene-store.js";
import { SCENE_STORE_KEY } from "@/pages/vector-geometry-lab/storage/scene-store.js";
import { createStubThree, STUB_CAPTURE_DATA_URL } from "./stub-three.js";

function createMemoryStorage(): {
  storage: StorageLike;
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
      },
      removeItem: (key) => {
        data.delete(key);
      },
    },
  };
}

interface DownloadCapture {
  deps: DownloadDeps;
  blobs: Blob[];
  anchors: Array<{ href: string; download: string }>;
}

/** jsdom Blobs lack .text(); read via FileReader instead. */
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("blob read failed"));
    reader.readAsText(blob);
  });
}

function createDownloadCapture(): DownloadCapture {
  const blobs: Blob[] = [];
  const anchors: Array<{ href: string; download: string }> = [];
  return {
    blobs,
    anchors,
    deps: {
      createObjectURL: (blob) => {
        blobs.push(blob);
        return `blob:mock-${blobs.length}`;
      },
      revokeObjectURL: () => undefined,
      clickAnchor: (anchor) => {
        anchors.push({ href: anchor.href, download: anchor.download });
      },
    },
  };
}

async function renderLab(options: {
  storage?: StorageLike;
  downloads?: DownloadCapture;
  printFn?: () => void;
  confirmFn?: (message: string) => boolean;
} = {}) {
  const stub = createStubThree();
  render(
    <VectorGeometryLabWorkspace
      loader={stub.loader}
      {...(options.storage !== undefined ? { storage: options.storage } : {})}
      {...(options.downloads !== undefined
        ? { downloadDeps: options.downloads.deps }
        : {})}
      {...(options.printFn !== undefined ? { printFn: options.printFn } : {})}
      {...(options.confirmFn !== undefined
        ? { confirmFn: options.confirmFn }
        : {})}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId("viewport3d")).toHaveAttribute("data-status", "ready"),
  );
  return stub;
}

describe("Storage panel — save / load / rename / delete through the UI", () => {
  it("saves the current scene and lists it", async () => {
    const user = userEvent.setup();
    const { storage, data } = createMemoryStorage();
    await renderLab({ storage });

    await user.type(screen.getByLabelText("Name for the current scene"), "homework 4");
    await user.click(screen.getByRole("button", { name: "Save current scene" }));

    expect(await screen.findByText("homework 4")).toBeInTheDocument();
    expect(data.has(SCENE_STORE_KEY)).toBe(true);
    const envelope = JSON.parse(data.get(SCENE_STORE_KEY)!) as {
      storageVersion: number;
      scenes: Array<{ name: string; exampleId: string }>;
    };
    expect(envelope.storageVersion).toBe(1);
    expect(envelope.scenes[0]?.name).toBe("homework 4");
    expect(envelope.scenes[0]?.exampleId).toBe("angle-between-vectors");
  });

  it("loads a saved scene after switching examples", async () => {
    const user = userEvent.setup();
    const { storage } = createMemoryStorage();
    await renderLab({ storage });

    // Save the angle example, switch away, then load it back.
    await user.type(screen.getByLabelText("Name for the current scene"), "angle scene");
    await user.click(screen.getByRole("button", { name: "Save current scene" }));
    await screen.findByText("angle scene");
    await user.selectOptions(
      screen.getByLabelText("Built-in example"),
      "point-point-distance",
    );
    expect(await screen.findAllByText(/distance = 5/)).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Load angle scene" }));
    // The angle analysis (90°, perpendicular) is back — recomputed by core.
    await waitFor(() =>
      expect(screen.getAllByText("perpendicular").length).toBeGreaterThan(0),
    );
    expect(screen.getByLabelText("Built-in example")).toHaveValue("angle-between-vectors");
  });

  it("renames and deletes entries inline", async () => {
    const user = userEvent.setup();
    const { storage, data } = createMemoryStorage();
    await renderLab({ storage });

    await user.type(screen.getByLabelText("Name for the current scene"), "old name");
    await user.click(screen.getByRole("button", { name: "Save current scene" }));
    await screen.findByText("old name");

    await user.click(screen.getByRole("button", { name: "Rename old name" }));
    const input = screen.getByLabelText("Rename old name");
    await user.clear(input);
    await user.type(input, "new name");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText("new name")).toBeInTheDocument();
    expect(screen.queryByText("old name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete new name" }));
    await waitFor(() =>
      expect(screen.getByText("尚未保存场景。")).toBeInTheDocument(),
    );
    const envelope = JSON.parse(data.get(SCENE_STORE_KEY)!) as { scenes: unknown[] };
    expect(envelope.scenes).toHaveLength(0);
  });

  it("corrupted storage at startup → structured error, lab keeps working", async () => {
    const { storage, data } = createMemoryStorage();
    data.set(SCENE_STORE_KEY, "{corrupted!!");
    await renderLab({ storage });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("not valid JSON");
    expect(alert.textContent).toContain("storage-corrupted");
    // The lab itself is fully functional — last valid analysis still shown.
    expect(screen.getAllByText(/90°/).length).toBeGreaterThan(0);
    // And the corrupted data was not wiped.
    expect(data.get(SCENE_STORE_KEY)).toBe("{corrupted!!");
  });
});

describe("Export panel — JSON / PNG / HTML / print / reset", () => {
  it("exports the scene JSON as a download", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    await renderLab({ downloads });

    await user.click(screen.getByRole("button", { name: "Download scene JSON" }));
    expect(downloads.anchors).toHaveLength(1);
    expect(downloads.anchors[0]?.download).toBe("ex-01.json");
    const text = await blobText(downloads.blobs[0]!);
    expect(JSON.parse(text)).toEqual(getExample("angle-between-vectors")!.scene);
    expect(await screen.findByRole("status")).toHaveTextContent(/downloaded/);
  });

  it("imports a valid scene JSON file", async () => {
    const user = userEvent.setup();
    const { storage } = createMemoryStorage();
    await renderLab({ storage });

    const example = getExample("skew-lines")!;
    const file = new File([sceneToJson(example.scene)], "skew.json", {
      type: "application/json",
    });
    const input = screen.getByLabelText("Import scene JSON file");
    await user.upload(input, file);

    await waitFor(() =>
      expect(screen.getAllByText(/distance = 2/).length).toBeGreaterThan(0),
    );
    expect(screen.getByLabelText("Built-in example")).toHaveValue("skew-lines");
    expect(screen.getByRole("status").textContent).toContain("skew.json");
  });

  it("refuses a corrupted import file with an alert and keeps the state", async () => {
    const user = userEvent.setup();
    await renderLab();

    const file = new File(["{definitely not json"], "broken.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText("Import scene JSON file"), file);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("not valid JSON");
    // Current analysis untouched.
    expect(screen.getAllByText("perpendicular").length).toBeGreaterThan(0);
  });

  it("exports a PNG at the chosen scale through the renderer handle", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    const stub = await renderLab({ downloads });

    await user.selectOptions(screen.getByLabelText("PNG export scale"), "3");
    await user.click(screen.getByRole("button", { name: "Download PNG" }));

    expect(stub.handle.capturePng).toHaveBeenCalledWith({ pixelRatio: 3 });
    expect(downloads.anchors).toHaveLength(1);
    expect(downloads.anchors[0]?.download).toBe("ex-01@3x.png");
    expect(downloads.anchors[0]?.href).toBe(STUB_CAPTURE_DATA_URL);
    expect(screen.getByRole("status").textContent).toContain("2400×1800");
  });

  it("surfaces a structured PNG capture failure instead of claiming a download", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    const stub = await renderLab({ downloads });
    stub.handle.capturePng.mockReturnValueOnce({
      ok: false,
      error: {
        code: "capture-failed",
        message: "GPU readback failed",
      },
    });

    await user.click(screen.getByRole("button", { name: "Download PNG" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PNG export failed: GPU readback failed",
    );
    expect(downloads.anchors).toHaveLength(0);
  });

  it("surfaces a browser download failure and keeps the solved result visible", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    const failingDownloads: DownloadCapture = {
      ...downloads,
      deps: {
        ...downloads.deps,
        clickAnchor: () => {
          throw new Error("download blocked");
        },
      },
    };
    await renderLab({ downloads: failingDownloads });

    await user.click(screen.getByRole("button", { name: "Download scene JSON" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Download failed (download blocked).",
    );
    expect(screen.getAllByText("perpendicular").length).toBeGreaterThan(0);
  });

  it("exports the HTML handout with the embedded snapshot", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    await renderLab({ downloads });

    await user.click(screen.getByRole("button", { name: "Download HTML handout" }));
    expect(downloads.anchors[0]?.download).toBe("ex-01-handout.html");
    const html = await blobText(downloads.blobs[0]!);
    expect(html).toContain("Known inputs");
    expect(html).toContain("Verification");
    expect(html).toContain(STUB_CAPTURE_DATA_URL);
    expect(html).not.toMatch(/https?:\/\//);
    expect(screen.getByRole("status").textContent).toContain("embedded 3D snapshot");
  });

  it("exports an HTML text fallback when a ready viewport cannot be captured", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    const stub = await renderLab({ downloads });
    stub.handle.capturePng.mockReturnValueOnce({
      ok: false,
      error: {
        code: "capture-failed",
        message: "capture unavailable",
      },
    });

    await user.click(screen.getByRole("button", { name: "Download HTML handout" }));

    const html = await blobText(downloads.blobs[0]!);
    expect(html).toContain("3D snapshot unavailable");
    expect(screen.getByRole("status")).toHaveTextContent("text fallback");
  });

  it("print button invokes the injected print function", async () => {
    const user = userEvent.setup();
    const printFn = vi.fn();
    await renderLab({ printFn });
    await user.click(screen.getByRole("button", { name: "Print handout" }));
    expect(printFn).toHaveBeenCalledTimes(1);
  });

  it("reset clears saved scenes and returns to the default example (confirmed)", async () => {
    const user = userEvent.setup();
    const { storage, data } = createMemoryStorage();
    const confirmFn = vi.fn(() => true);
    await renderLab({ storage, confirmFn });

    await user.type(screen.getByLabelText("Name for the current scene"), "keep me");
    await user.click(screen.getByRole("button", { name: "Save current scene" }));
    await screen.findByText("keep me");
    await user.selectOptions(
      screen.getByLabelText("Built-in example"),
      "point-point-distance",
    );

    await user.click(screen.getByRole("button", { name: "Reset lab" }));
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(data.has(SCENE_STORE_KEY)).toBe(false);
    expect(await screen.findByText("尚未保存场景。")).toBeInTheDocument();
    expect(screen.getByLabelText("Built-in example")).toHaveValue("angle-between-vectors");
    expect(screen.getAllByText("perpendicular").length).toBeGreaterThan(0);
  });

  it("reset does nothing when the user cancels", async () => {
    const user = userEvent.setup();
    const { storage, data } = createMemoryStorage();
    await renderLab({ storage, confirmFn: () => false });

    await user.type(screen.getByLabelText("Name for the current scene"), "keep me");
    await user.click(screen.getByRole("button", { name: "Save current scene" }));
    await screen.findByText("keep me");

    await user.click(screen.getByRole("button", { name: "Reset lab" }));
    expect(data.has(SCENE_STORE_KEY)).toBe(true);
    expect(screen.getByText("keep me")).toBeInTheDocument();
  });
});

describe("Export panel — degraded viewport", () => {
  it("PNG button is disabled with an explanation; HTML still exports with text fallback", async () => {
    const user = userEvent.setup();
    const downloads = createDownloadCapture();
    const stub = createStubThree({ webglSupported: false });
    render(<VectorGeometryLabWorkspace loader={stub.loader} downloadDeps={downloads.deps} />);
    await waitFor(() =>
      expect(screen.getByTestId("viewport3d")).toHaveAttribute(
        "data-status",
        "unavailable",
      ),
    );

    const pngButton = screen.getByRole("button", { name: "Download PNG" });
    expect(pngButton).toBeDisabled();
    expect(
      screen.getByText(/三维视图不可用或仍在加载时，PNG 导出会停用/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download HTML handout" }));
    const html = await blobText(downloads.blobs[0]!);
    expect(html).toContain("3D snapshot unavailable");
    expect(html).toContain("Known inputs");
    expect(html).toContain("Verification");
    expect(screen.getByRole("status").textContent).toContain("text fallback");
  });
});
