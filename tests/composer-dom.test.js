import test from "node:test";
import assert from "node:assert/strict";

import {
  getAttachmentExtensionLabel,
  getAttachmentInfoLabel,
} from "../src/features/composer/composer-dom.ts";

test("getAttachmentExtensionLabel returns an uppercase compact extension", () => {
  assert.equal(getAttachmentExtensionLabel("report.pdf"), "PDF");
  assert.equal(getAttachmentExtensionLabel("archive.tar.gz"), "GZ");
  assert.equal(getAttachmentExtensionLabel("filename"), "FILE");
  assert.equal(getAttachmentExtensionLabel("very.longextension"), "LONG");
});

test("getAttachmentInfoLabel combines kind and formatted size", () => {
  assert.equal(getAttachmentInfoLabel({ kind: "image", size: 1536 }), "图片 · 1.5 KB");
  assert.equal(getAttachmentInfoLabel({ kind: "file", size: 2048 }), "文件 · 2.0 KB");
});
