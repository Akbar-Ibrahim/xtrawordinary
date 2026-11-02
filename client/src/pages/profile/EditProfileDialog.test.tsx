import assert from "node:assert/strict";
import test from "node:test";
import { act, useState } from "react";
import type { Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { JSDOM } from "jsdom";
import { MAX_AVATAR_UPLOAD_BYTES } from "@shared/avatar";
import { queryClient } from "@/lib/queryClient";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  HTMLInputElement: { configurable: true, value: dom.window.HTMLInputElement },
  Node: { configurable: true, value: dom.window.Node },
  NodeFilter: { configurable: true, value: dom.window.NodeFilter },
  Event: { configurable: true, value: dom.window.Event },
  CustomEvent: { configurable: true, value: dom.window.CustomEvent },
  MutationObserver: { configurable: true, value: dom.window.MutationObserver },
  PointerEvent: { configurable: true, value: dom.window.MouseEvent },
  getComputedStyle: {
    configurable: true,
    value: dom.window.getComputedStyle.bind(dom.window),
  },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalXMLHttpRequest = globalThis.XMLHttpRequest;
let container: HTMLDivElement | undefined;
let root: Root | undefined;
let saveCalls: Array<{
  data: { username?: string; name?: string; avatarUrl?: string | null; bio?: string | null };
  avatarFile?: File;
}> = [];
let uploadAvatar: ((file: File) => Promise<void>) | undefined;
let cancelAvatarUpload: (() => void) | undefined;
let isAvatarUploadPending: boolean | undefined;
let avatarUploadHandler: ((request: MockXMLHttpRequest, body: BodyInit | null) => void) | undefined;

class MockXMLHttpRequest {
  uploadListeners: Array<(event: ProgressEvent) => void> = [];
  listeners = new Map<string, Array<(event: ProgressEvent) => void>>();
  status = 0;
  responseText = "";
  withCredentials = false;
  url = "";
  aborted = false;

  upload = {
    addEventListener: (_type: string, listener: (event: ProgressEvent) => void) => {
      this.uploadListeners.push(listener);
    },
  };

  open(_method: string, url: string) {
    this.url = url;
  }

  setRequestHeader(_name: string, _value: string) {}

  addEventListener(type: string, listener: (event: ProgressEvent) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    avatarUploadHandler?.(this, body as BodyInit | null);
  }

  reportProgress(loaded: number, total: number, lengthComputable = true) {
    const event = { loaded, total, lengthComputable } as ProgressEvent;
    this.uploadListeners.forEach((listener) => listener(event));
  }

  finish(status: number, responseText = "") {
    this.status = status;
    this.responseText = responseText;
    const event = new dom.window.ProgressEvent("load");
    this.listeners.get("load")?.forEach((listener) => listener(event));
  }

  fail() {
    const event = new dom.window.ProgressEvent("error");
    this.listeners.get("error")?.forEach((listener) => listener(event));
  }

  abort() {
    this.aborted = true;
    const event = new dom.window.ProgressEvent("abort");
    this.listeners.get("abort")?.forEach((listener) => listener(event));
  }
}

function mockAvatarUpload(handler: (request: MockXMLHttpRequest, body: BodyInit | null) => void) {
  avatarUploadHandler = handler;
  Object.defineProperty(globalThis, "XMLHttpRequest", {
    configurable: true,
    value: MockXMLHttpRequest,
  });
}

async function renderDialog(avatarUrl: string | null = null) {
  const { createRoot } = await import("react-dom/client");
  const { EditProfileDialog } = await import("./EditProfileDialog");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  saveCalls = [];

  const onSave = async (
    data: { username?: string; name?: string; avatarUrl?: string | null; bio?: string | null },
    avatarFile?: File,
  ) => {
    saveCalls.push({ data, avatarFile });
  };

  await act(async () => {
    root!.render(
      <>
        <EditProfileDialog
          open
          onOpenChange={() => {}}
          onCancelUpload={() => {}}
          profileUser={{
            username: "word_player",
            name: "Word Player",
            avatarUrl,
            bio: null,
          }}
          onSave={onSave}
          isPending={false}
          isUploadingAvatar={false}
          avatarUploadProgress={null}
        />
      </>,
    );
    await Promise.resolve();
  });
}

async function renderAvatarUpload(userId: number) {
  const { AuthProvider } = await import("@/lib/auth-context");
  const { useToast } = await import("@/hooks/use-toast");
  const { useAvatarUpload } = await import("./useAvatarUpload");
  const { createRoot } = await import("react-dom/client");

  function AvatarUploadHarness() {
    const upload = useAvatarUpload(userId);
    const { toasts } = useToast();
    uploadAvatar = upload.uploadAvatar;
    cancelAvatarUpload = upload.cancelAvatarUpload;
    isAvatarUploadPending = upload.isUploadingAvatar;

    return (
      <div>
        {toasts.map((toast) => (
          <div data-testid="avatar-upload-toast" key={toast.id}>
            {toast.title}: {toast.description}
          </div>
        ))}
      </div>
    );
  }

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AvatarUploadHarness />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderRetryableProfileDialog(userId: number) {
  const { AuthProvider } = await import("@/lib/auth-context");
  const { useAvatarUpload } = await import("./useAvatarUpload");
  const { EditProfileDialog } = await import("./EditProfileDialog");
  const { createRoot } = await import("react-dom/client");

  function ProfileEditorHarness() {
    const [open, setOpen] = useState(true);
    const { uploadAvatar, cancelAvatarUpload, isUploadingAvatar, avatarUploadProgress } = useAvatarUpload(userId);

    return (
      <EditProfileDialog
        open={open}
        onOpenChange={setOpen}
        profileUser={{
          username: "word_player",
          name: "Word Player",
          avatarUrl: null,
          bio: null,
        }}
        onSave={async (_data, avatarFile) => {
          try {
            if (avatarFile) await uploadAvatar(avatarFile);
            setOpen(false);
          } catch {
            // Match the profile page: preserve the editor after a failed upload.
          }
        }}
        onCancelUpload={cancelAvatarUpload}
        isPending={isUploadingAvatar}
        isUploadingAvatar={isUploadingAvatar}
        avatarUploadProgress={avatarUploadProgress}
      />
    );
  }

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ProfileEditorHarness />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function getInput<T extends HTMLInputElement>(testId: string): T {
  const input = document.body.querySelector<T>(`[data-testid="${testId}"]`);
  assert.ok(input, `Expected ${testId} to be rendered`);
  return input;
}

async function clickSave() {
  const button = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="button-save-profile"]',
  );
  assert.ok(button, "Expected the Save button to be rendered");
  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function selectFile(file: File) {
  const input = getInput<HTMLInputElement>("input-edit-avatar-file");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  act(() => {
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
}

test.afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
  }
  container?.remove();
  document.body.replaceChildren();
  root = undefined;
  container = undefined;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  avatarUploadHandler = undefined;
  Object.defineProperty(globalThis, "XMLHttpRequest", {
    configurable: true,
    value: originalXMLHttpRequest,
  });
  uploadAvatar = undefined;
  cancelAvatarUpload = undefined;
  isAvatarUploadPending = undefined;
  queryClient.clear();
});

test("saving an allowed image passes the selected file to the save callback", async () => {
  URL.createObjectURL = () => "blob:test-avatar";
  URL.revokeObjectURL = () => {};
  await renderDialog();

  const file = new File(["avatar"], "avatar.png", { type: "image/png" });
  selectFile(file);
  await clickSave();

  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0].data, {});
  assert.equal(saveCalls[0].avatarFile, file);
});

test("canceling an upload keeps the selected photo available for retry", async () => {
  URL.createObjectURL = () => "blob:test-avatar";
  URL.revokeObjectURL = () => {};
  let uploadAttempts = 0;
  let firstRequest: MockXMLHttpRequest | undefined;
  const uploadedFiles: BodyInit[] = [];
  mockAvatarUpload((request, body) => {
    uploadAttempts += 1;
    uploadedFiles.push(body as BodyInit);
    if (uploadAttempts === 1) {
      firstRequest = request;
      request.reportProgress(2, 4);
      return;
    }
    request.finish(200);
  });
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/auth/me") {
      return { ok: true, json: async () => ({ user: null }) } as Response;
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  };
  await renderRetryableProfileDialog(42);

  const photo = new File(["avatar"], "avatar.png", { type: "image/png" });
  selectFile(photo);
  await clickSave();
  assert.equal(uploadAttempts, 1);
  assert.ok(firstRequest);

  const cancelUploadButton = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="button-cancel-avatar-upload"]',
  );
  assert.ok(cancelUploadButton);
  await act(async () => {
    cancelUploadButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(firstRequest.aborted, true, "cancel should abort the active request");
  assert.ok(document.body.querySelector('[data-testid="dialog-edit-profile"]'));
  assert.equal(
    document.body.querySelector('[data-testid="avatar-upload-progress"]'),
    null,
    "progress should clear after cancellation",
  );
  assert.equal(uploadAttempts, 1, "cancellation should not start a replacement request");

  await clickSave();

  assert.equal(uploadAttempts, 2);
  assert.deepEqual(uploadedFiles, [photo, photo], "retry should use the photo that was already selected");
  assert.equal(document.body.querySelector('[data-testid="dialog-edit-profile"]'), null);
});

test("closing the editor aborts an active photo upload without refreshing the avatar", async () => {
  let authRefreshes = 0;
  let activeRequest: MockXMLHttpRequest | undefined;
  mockAvatarUpload((request) => {
    activeRequest = request;
    request.reportProgress(2, 4);
  });
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/auth/me") {
      authRefreshes += 1;
      return { ok: true, json: async () => ({ user: null }) } as Response;
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  };
  await renderRetryableProfileDialog(42);
  selectFile(new File(["avatar"], "avatar.png", { type: "image/png" }));
  await clickSave();

  const cancelButton = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="button-cancel-edit"]',
  );
  assert.ok(cancelButton);
  await act(async () => {
    cancelButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(activeRequest?.aborted, true);
  assert.equal(document.body.querySelector('[data-testid="dialog-edit-profile"]'), null);
  assert.equal(authRefreshes, 1, "cancellation must not run the successful-upload refresh");
});

test("clearing the avatar submits a null avatar URL", async () => {
  await renderDialog("https://example.com/avatar.jpg");
  const avatarUrlInput = getInput<HTMLInputElement>("input-edit-avatar-url");
  const setInputValue = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  )?.set;
  assert.ok(setInputValue);
  act(() => {
    setInputValue.call(avatarUrlInput, "");
    avatarUrlInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });

  await clickSave();

  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0].data, { avatarUrl: null });
  assert.equal(saveCalls[0].avatarFile, undefined);
});

test("invalid image selection shows validation and prevents saving", async () => {
  await renderDialog();

  selectFile(new File(["not an image"], "avatar.gif", { type: "image/gif" }));

  const alert = document.body.querySelector('[role="alert"]');
  assert.ok(alert);
  assert.equal(alert.textContent, "Choose a PNG, JPEG, or WebP image.");

  const saveButton = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="button-save-profile"]',
  );
  assert.ok(saveButton);
  assert.equal(saveButton.disabled, true);
  await clickSave();
  assert.equal(saveCalls.length, 0);
});

test("oversized image selection shows the size limit and prevents saving", async () => {
  await renderDialog();

  const oversizedImage = new File(
    [new Uint8Array(MAX_AVATAR_UPLOAD_BYTES + 1)],
    "large-avatar.png",
    { type: "image/png" },
  );
  selectFile(oversizedImage);

  const alert = document.body.querySelector('[role="alert"]');
  assert.ok(alert);
  assert.equal(alert.textContent, "Choose an image no larger than 5 MB.");

  const saveButton = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="button-save-profile"]',
  );
  assert.ok(saveButton);
  assert.equal(saveButton.disabled, true);
  await clickSave();
  assert.equal(saveCalls.length, 0);
});

test("failed avatar upload shows the server error without refreshing user or profile data", async () => {
  const userId = 42;
  const profileKey = ["/api/users", userId, "profile"];
  let authRefreshes = 0;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/auth/me") {
      authRefreshes += 1;
      return { ok: true, json: async () => ({ user: null }) } as Response;
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  };
  mockAvatarUpload((request) => {
    request.finish(400, JSON.stringify({ error: "Avatar image was rejected" }));
  });
  await queryClient.fetchQuery({
    queryKey: profileKey,
    queryFn: async () => ({ username: "word_player" }),
  });
  await queryClient.fetchQuery({
    queryKey: ["/api/users", 99, "profile"],
    queryFn: async () => ({ username: "another_player" }),
  });

  await renderAvatarUpload(userId);
  assert.ok(uploadAvatar);
  await act(async () => {
    await assert.rejects(
      uploadAvatar!(new File(["avatar"], "avatar.png", { type: "image/png" })),
      /Avatar image was rejected/,
    );
  });

  assert.equal(authRefreshes, 1);
  assert.equal(isAvatarUploadPending, false);
  assert.equal(queryClient.getQueryState(profileKey)?.isInvalidated, false);
  assert.equal(
    queryClient.getQueryState(["/api/users", 99, "profile"])?.isInvalidated,
    false,
  );
  assert.match(
    container?.querySelector('[data-testid="avatar-upload-toast"]')?.textContent ?? "",
    /Avatar upload failed: Avatar image was rejected/,
  );
});

test("network failure shows its error without refreshing the signed-in user", async () => {
  let authRefreshes = 0;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/auth/me") {
      authRefreshes += 1;
      return { ok: true, json: async () => ({ user: null }) } as Response;
    }
    throw new Error("Network unavailable");
  };
  mockAvatarUpload((request) => request.fail());

  await renderAvatarUpload(42);
  assert.ok(uploadAvatar);
  await act(async () => {
    await assert.rejects(
      uploadAvatar!(new File(["avatar"], "avatar.png", { type: "image/png" })),
      /Network error while uploading avatar/,
    );
  });

  assert.equal(authRefreshes, 1);
  assert.equal(isAvatarUploadPending, false);
  assert.match(
    container?.querySelector('[data-testid="avatar-upload-toast"]')?.textContent ?? "",
    /Avatar upload failed: Network error while uploading avatar/,
  );
});

test("successful avatar upload refreshes user and invalidates only its profile query", async () => {
  const userId = 42;
  const profileKey = ["/api/users", userId, "profile"];
  let authRefreshes = 0;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/auth/me") {
      authRefreshes += 1;
      return { ok: true, json: async () => ({ user: null }) } as Response;
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  };
  mockAvatarUpload((request) => request.finish(200));
  await queryClient.fetchQuery({
    queryKey: profileKey,
    queryFn: async () => ({ username: "word_player" }),
  });
  await queryClient.fetchQuery({
    queryKey: ["/api/users", 99, "profile"],
    queryFn: async () => ({ username: "another_player" }),
  });

  await renderAvatarUpload(userId);
  assert.ok(uploadAvatar);
  await act(async () => {
    await uploadAvatar!(new File(["avatar"], "avatar.png", { type: "image/png" }));
  });

  assert.equal(authRefreshes, 2);
  assert.equal(isAvatarUploadPending, false);
  assert.equal(queryClient.getQueryState(profileKey)?.isInvalidated, true);
  assert.equal(
    queryClient.getQueryState(["/api/users", 99, "profile"])?.isInvalidated,
    false,
  );
});

test("a failed profile photo upload stays open with the photo selected and can be retried", async () => {
  URL.createObjectURL = () => "blob:test-avatar";
  URL.revokeObjectURL = () => {};
  let uploadAttempts = 0;
  let finishFirstUpload: (() => void) | undefined;
  let firstRequest: MockXMLHttpRequest | undefined;
  const uploadedFiles: BodyInit[] = [];
  mockAvatarUpload((request, body) => {
    uploadAttempts += 1;
    uploadedFiles.push(body as BodyInit);
    if (uploadAttempts === 1) {
      firstRequest = request;
      request.reportProgress(4, 8);
      finishFirstUpload = () => request.finish(
        400,
        JSON.stringify({ error: "Temporary upload failure" }),
      );
      return;
    }
    request.finish(200);
  });
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/auth/me") {
      return { ok: true, json: async () => ({ user: null }) } as Response;
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  };
  await renderRetryableProfileDialog(42);

  const photo = new File(["avatar"], "avatar.png", { type: "image/png" });
  selectFile(photo);
  await clickSave();

  assert.equal(uploadAttempts, 1);
  assert.ok(document.body.querySelector('[data-testid="avatar-upload-progress"]'));
  assert.match(
    document.body.querySelector('[data-testid="avatar-upload-progress"]')?.textContent ?? "",
    /50%/,
    "measurable upload progress should be shown as a percentage",
  );
  const progressBar = document.body.querySelector<HTMLProgressElement>(
    '[data-testid="avatar-upload-progress"] progress',
  );
  assert.equal(progressBar?.value, 50);
  const saveButton = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="button-save-profile"]',
  );
  assert.ok(saveButton?.disabled, "Save should remain disabled during the upload");
  assert.ok(document.body.querySelector('[data-testid="dialog-edit-profile"]'));
  assert.equal(uploadedFiles[0], photo, "the selected photo should be submitted on the first attempt");

  assert.ok(firstRequest);
  await act(async () => {
    firstRequest!.reportProgress(4, 0, false);
    await Promise.resolve();
  });
  assert.equal(
    document.body.querySelector<HTMLProgressElement>(
      '[data-testid="avatar-upload-progress"] progress',
    )?.hasAttribute("value"),
    false,
    "progress should be indeterminate when the browser cannot report a total",
  );
  assert.doesNotMatch(
    document.body.querySelector('[data-testid="avatar-upload-progress"]')?.textContent ?? "",
    /%/,
  );

  assert.ok(finishFirstUpload);
  await act(async () => {
    finishFirstUpload!();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(
    document.body.querySelector('[data-testid="avatar-upload-progress"]'),
    null,
    "upload progress should clear after failure",
  );
  assert.equal(saveButton?.disabled, false, "Save should be enabled again after failure");

  await clickSave();

  assert.equal(uploadAttempts, 2);
  assert.deepEqual(uploadedFiles, [photo, photo]);
  assert.equal(document.body.querySelector('[data-testid="dialog-edit-profile"]'), null);
});
