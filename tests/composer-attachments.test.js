import test from "node:test";
import assert from "node:assert/strict";

import {
  dataUrlToBase64,
  formatAttachmentSize,
  guessMimeTypeFromName,
  hasDraggedFiles,
  isImageType,
  serializeAttachments,
  uniqueAttachments,
} from "../src/features/composer/attachments.ts";

test("formatAttachmentSize uses compact human readable units", () => {
  assert.equal(formatAttachmentSize(0), "0 B");
  assert.equal(formatAttachmentSize(512), "512 B");
  assert.equal(formatAttachmentSize(1536), "1.5 KB");
  assert.equal(formatAttachmentSize(10 * 1024), "10 KB");
  assert.equal(formatAttachmentSize(2 * 1024 * 1024), "2.0 MB");
});

test("dataUrlToBase64 strips the data url prefix when present", () => {
  assert.equal(dataUrlToBase64("data:image/png;base64,abc123"), "abc123");
  assert.equal(dataUrlToBase64("raw-base64"), "raw-base64");
});

test("isImageType detects image mime types", () => {
  assert.equal(isImageType({ type: "image/png" }), true);
  assert.equal(isImageType({ type: "application/pdf" }), false);
});

test("guessMimeTypeFromName maps common file extensions", () => {
  assert.equal(guessMimeTypeFromName("photo.JPG"), "image/jpeg");
  assert.equal(guessMimeTypeFromName("notes.md"), "text/markdown");
  assert.equal(guessMimeTypeFromName("sheet.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(guessMimeTypeFromName("unknown.bin"), "application/octet-stream");
});

test("uniqueAttachments deduplicates by content identity", () => {
  const existing = [
    { name: "a.png", size: 10, type: "image/png", base64: "same" },
  ];
  const incoming = [
    { name: "a.png", size: 10, type: "image/png", base64: "same" },
    { name: "b.pdf", size: 20, type: "application/pdf", base64: "other" },
  ];

  assert.deepEqual(uniqueAttachments(existing, incoming), [
    { name: "a.png", size: 10, type: "image/png", base64: "same" },
    { name: "b.pdf", size: 20, type: "application/pdf", base64: "other" },
  ]);
});

test("serializeAttachments keeps only upload payload fields", () => {
  assert.deepEqual(
    serializeAttachments([
      {
        id: "1",
        name: "a.png",
        type: "image/png",
        size: 10,
        kind: "image",
        previewUrl: "blob:",
        base64: "abc",
      },
    ]),
    [
      {
        name: "a.png",
        mimeType: "image/png",
        size: 10,
        kind: "image",
        base64: "abc",
      },
    ],
  );
});

test("hasDraggedFiles accepts files from files, items, or types", () => {
  assert.equal(hasDraggedFiles(null), false);
  assert.equal(hasDraggedFiles({ files: { length: 1 } }), true);
  assert.equal(hasDraggedFiles({ files: { length: 0 }, items: [{ kind: "file" }] }), true);
  assert.equal(hasDraggedFiles({ files: { length: 0 }, items: [], types: ["Files"] }), true);
});
