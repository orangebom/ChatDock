mod site_probe;

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{webview::PageLoadEvent, AppHandle, Emitter, Manager};
use std::time::Duration;

use site_probe::probe_sites;

#[derive(Clone, Copy)]
struct SiteConfig {
    label: &'static str,
    title: &'static str,
    url: &'static str,
    data_directory: &'static str,
    accent_color: &'static str,
    input_selectors: &'static [&'static str],
    submit_selectors: &'static [&'static str],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SiteMeta {
    label: &'static str,
    title: &'static str,
    url: &'static str,
    data_directory: &'static str,
    accent_color: &'static str,
}

#[derive(Serialize)]
struct CommandResult {
    label: String,
    ok: bool,
    message: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PromptAttachment {
    name: String,
    mime_type: String,
    size: usize,
    kind: String,
    base64: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SiteAvailabilityEvent {
    label: String,
    available: bool,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentDebugEvent {
    label: String,
    stage: String,
    message: String,
}

const SITE_AVAILABILITY_SYNC_EVENT: &str = "site-availability-sync";
const ATTACHMENT_DEBUG_EVENT: &str = "attachment-injection-debug";

const SITE_REGISTRY: [SiteConfig; 12] = [
    SiteConfig {
        label: "chatgpt",
        title: "ChatGPT",
        url: "https://chatgpt.com/",
        data_directory: "sessions/chatgpt",
        accent_color: "#4edea3",
        input_selectors: &[
            "#prompt-textarea",
            "textarea[data-id]",
            "textarea",
            "[contenteditable='true'][data-lexical-editor='true']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[data-testid='send-button']",
            "button[aria-label*='Send']",
            "button[type='submit']",
        ],
    },
    SiteConfig {
        label: "claude",
        title: "Claude",
        url: "https://claude.ai/",
        data_directory: "sessions/claude",
        accent_color: "#dba6ff",
        input_selectors: &[
            "div[contenteditable='true'][data-testid='composer-input']",
            "div[contenteditable='true'][role='textbox']",
            "fieldset div[contenteditable='true']",
            "textarea",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[data-testid='send-button']",
            "button[aria-label*='Send']",
            "button[type='submit']",
        ],
    },
    SiteConfig {
        label: "gemini",
        title: "Gemini",
        url: "https://gemini.google.com/app",
        data_directory: "sessions/gemini",
        accent_color: "#4d8eff",
        input_selectors: &[
            "rich-textarea .ql-editor",
            "rich-textarea textarea",
            "textarea",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='Send']",
            "button[mattooltip*='Send']",
            "button[type='submit']",
        ],
    },
    SiteConfig {
        label: "copilot",
        title: "Copilot",
        url: "https://copilot.microsoft.com/",
        data_directory: "sessions/copilot",
        accent_color: "#7db3ff",
        input_selectors: &[
            "textarea[data-testid='chat_input_input']",
            ".semi-input-textarea.semi-input-textarea-autosize",
            "textarea[placeholder*='AI']",
            "textarea.semi-input-textarea",
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='Send']",
            "button[type='submit']",
            "[data-testid*='send']",
        ],
    },
    SiteConfig {
        label: "perplexity",
        title: "Perplexity",
        url: "https://www.perplexity.ai/",
        data_directory: "sessions/perplexity",
        accent_color: "#49d7c4",
        input_selectors: &[
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='Submit']",
            "button[aria-label*='Send']",
            "button[type='submit']",
        ],
    },
    SiteConfig {
        label: "grok",
        title: "Grok",
        url: "https://grok.com/",
        data_directory: "sessions/grok",
        accent_color: "#f29bb7",
        input_selectors: &[
            "div.tiptap.ProseMirror",
            "textarea#chat-input",
            "textarea[placeholder*='Ask']",
            "textarea[data-testid='grok-input']",
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label='Send message']",
            "button[aria-label*='Send']",
            "button[data-testid='send-button']",
            "form button[type='submit']",
            "button[type='submit']",
            "[data-testid*='send']",
        ],
    },
    SiteConfig {
        label: "deepseek",
        title: "DeepSeek",
        url: "https://chat.deepseek.com/",
        data_directory: "sessions/deepseek",
        accent_color: "#1f3f8f",
        input_selectors: &["textarea", "[contenteditable='true']"],
        submit_selectors: &[
            "button[aria-label*='Send']",
            "button[type='submit']",
            "div[role='button']",
            "button:has(svg)",
        ],
    },
    SiteConfig {
        label: "kimi",
        title: "Kimi",
        url: "https://kimi.moonshot.cn/",
        data_directory: "sessions/kimi",
        accent_color: "#f59a23",
        input_selectors: &[
            ".chat-input-editor[data-lexical-editor='true']",
            "[contenteditable='true'][data-lexical-editor='true']",
            "[contenteditable='true']",
            "textarea",
        ],
        submit_selectors: &[
            ".send-button-container",
            "div.send-button-container",
            "button[aria-label*='Send']",
            "button[type='submit']",
            "div[role='button']",
        ],
    },
    SiteConfig {
        label: "qwen",
        title: "Qwen",
        url: "https://www.qianwen.com/",
        data_directory: "sessions/qwen",
        accent_color: "#7a8cff",
        input_selectors: &[
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='Send']",
            "button[type='submit']",
            "[data-testid*='send']",
        ],
    },
    SiteConfig {
        label: "doubao",
        title: "豆包",
        url: "https://www.doubao.com/chat/",
        data_directory: "sessions/doubao",
        accent_color: "#6eb5ff",
        input_selectors: &[
            "textarea[data-testid='chat_input_input']",
            ".semi-input-textarea.semi-input-textarea-autosize",
            "textarea[placeholder*='AI']",
            "textarea.semi-input-textarea",
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='发送']",
            "button[aria-label*='Send']",
            "button[type='submit']",
        ],
    },
    SiteConfig {
        label: "yuanbao",
        title: "元宝",
        url: "https://yuanbao.tencent.com/",
        data_directory: "sessions/yuanbao",
        accent_color: "#24c18f",
        input_selectors: &[
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='发送']",
            "button[aria-label*='Send']",
            "button[type='submit']",
        ],
    },
    SiteConfig {
        label: "zhipu",
        title: "智谱清言",
        url: "https://chatglm.cn/main/alltoolsdetail",
        data_directory: "sessions/zhipu",
        accent_color: "#ff8f7c",
        input_selectors: &[
            "textarea",
            "[contenteditable='true'][role='textbox']",
            "[contenteditable='true']",
        ],
        submit_selectors: &[
            "button[aria-label*='发送']",
            "button[aria-label*='Send']",
            "button[type='submit']",
        ],
    },
];

#[tauri::command]
fn list_sites() -> Vec<SiteMeta> {
    SITE_REGISTRY
        .iter()
        .map(|site| SiteMeta {
            label: site.label,
            title: site.title,
            url: site.url,
            data_directory: site.data_directory,
            accent_color: site.accent_color,
        })
        .collect()
}

#[tauri::command]
fn broadcast_prompt(
    app: AppHandle<tauri::Wry>,
    prompt: String,
    targets: Vec<String>,
    attachments: Option<Vec<PromptAttachment>>,
) -> Vec<CommandResult> {
    let attachments = attachments.unwrap_or_default();
    resolve_targets(targets)
        .iter()
        .map(|site| run_for_webview(&app, site.label, &build_send_script(site, &prompt, &attachments, true)))
        .collect()
}

#[tauri::command]
fn inject_attachments(
    app: AppHandle<tauri::Wry>,
    target: String,
    attachments: Option<Vec<PromptAttachment>>,
) -> CommandResult {
    let attachments = attachments.unwrap_or_default();
    if attachments.is_empty() {
        emit_attachment_debug(&app, &target, "inject-command", "no attachments provided");
        return CommandResult {
            label: target,
            ok: false,
            message: "no attachments provided".to_string(),
        };
    }

    let Some(site) = find_site(&target) else {
        emit_attachment_debug(&app, &target, "inject-command", "unknown target");
        return CommandResult {
            label: target,
            ok: false,
            message: "unknown target".to_string(),
        };
    };

    emit_attachment_debug(
        &app,
        site.label,
        "inject-command",
        &format!("dispatching {} attachments", attachments.len()),
    );

    let result = run_for_webview(
        &app,
        site.label,
        &build_send_script(site, "", &attachments, false),
    );

    emit_attachment_debug(
        &app,
        site.label,
        "inject-command-result",
        &result.message,
    );

    result
}

#[tauri::command]
fn reload_webviews(app: AppHandle<tauri::Wry>, targets: Vec<String>) -> Vec<CommandResult> {
    resolve_targets(targets)
        .iter()
        .map(|site| run_for_webview(&app, site.label, "window.location.reload();"))
        .collect()
}

#[tauri::command]
async fn probe_site_availability(
    targets: Vec<String>,
    timeout_ms: Option<u64>,
) -> Vec<site_probe::SiteAvailabilityResult> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(7000));
    let resolved = resolve_targets(targets);
    probe_sites(resolved.into_iter().map(|site| (site.label, site.url)), timeout).await
}

#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|error| error.to_string())
}

fn resolve_targets(targets: Vec<String>) -> Vec<&'static SiteConfig> {
    if targets.is_empty() {
        return SITE_REGISTRY.iter().collect();
    }

    let mut resolved = Vec::new();
    for target in targets {
        if let Some(site) = find_site(&target) {
            if !resolved.iter().any(|current: &&SiteConfig| current.label == site.label) {
                resolved.push(site);
            }
        }
    }
    resolved
}

fn find_site(label: &str) -> Option<&'static SiteConfig> {
    SITE_REGISTRY.iter().find(|site| site.label == label)
}

fn run_for_webview(app: &AppHandle<tauri::Wry>, label: &str, script: &str) -> CommandResult {
    if let Some(webview) = app.get_webview(label) {
        match webview.eval(script) {
            Ok(_) => CommandResult {
                label: label.to_string(),
                ok: true,
                message: "script injected".to_string(),
            },
            Err(error) => CommandResult {
                label: label.to_string(),
                ok: false,
                message: error.to_string(),
            },
        }
    } else {
        CommandResult {
            label: label.to_string(),
            ok: false,
            message: "webview not found".to_string(),
        }
    }
}

fn emit_attachment_debug(app: &AppHandle<tauri::Wry>, label: &str, stage: &str, message: &str) {
    let _ = app.emit(
        ATTACHMENT_DEBUG_EVENT,
        AttachmentDebugEvent {
            label: label.to_string(),
            stage: stage.to_string(),
            message: message.to_string(),
        },
    );
}

fn build_send_script(site: &SiteConfig, prompt: &str, attachments: &[PromptAttachment], should_submit: bool) -> String {
    let prompt_json = serde_json::to_string(prompt).expect("prompt should serialize");
    let inputs = serde_json::to_string(site.input_selectors).expect("inputs should serialize");
    let submits = serde_json::to_string(site.submit_selectors).expect("submits should serialize");
    let attachments_json =
        serde_json::to_string(attachments).expect("attachments should serialize");
    let should_submit_json =
        serde_json::to_string(&should_submit).expect("submit flag should serialize");

    format!(
        r#"
(() => {{
  const siteLabel = {site_label};
  const prompt = {prompt_json};
  const inputSelectors = {input_selectors};
  const submitSelectors = {submit_selectors};
  const attachments = {attachments_json};
  const shouldSubmit = {should_submit_json};
  const sendPattern = /send|submit|\u53d1\u9001|\u63d0\u4ea4|\u95ee\u4e00\u95ee/iu;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const remainingTime = (deadline) => Math.max(0, deadline - Date.now());
  const sleepWithin = async (ms, deadline) => {{
    const wait = Math.min(ms, remainingTime(deadline));
    if (wait > 0) {{
      await sleep(wait);
    }}
  }};

  const dispatchKeyboard = (element, type, key, options = {{}}) => {{
    element.dispatchEvent(new KeyboardEvent(type, {{
      key,
      code: key,
      which: key === 'Enter' ? 13 : undefined,
      keyCode: key === 'Enter' ? 13 : undefined,
      bubbles: true,
      cancelable: true,
      composed: true,
      ...options
    }}));
  }};

  const dispatchInput = (element, value) => {{
    element.dispatchEvent(new InputEvent('beforeinput', {{
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: 'insertText',
      data: value
    }}));

    element.dispatchEvent(new InputEvent('input', {{
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: value
    }}));

    element.dispatchEvent(new Event('change', {{
      bubbles: true,
      composed: true
    }}));
  }};

  const dispatchPlainInput = (element) => {{
    element.dispatchEvent(new Event('input', {{
      bubbles: true,
      composed: true
    }}));

    element.dispatchEvent(new Event('change', {{
      bubbles: true,
      composed: true
    }}));
  }};

  const dispatchClipboardPaste = (element, value) => {{
    try {{
      const data = new DataTransfer();
      data.setData('text/plain', value);
      return element.dispatchEvent(new ClipboardEvent('paste', {{
        clipboardData: data,
        bubbles: true,
        cancelable: true,
        composed: true
      }}));
    }} catch (_error) {{
      return false;
    }}
  }};

  const setCaretToEnd = (element) => {{
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }};

  const resetRichEditor = (element) => {{
    const paragraph = document.createElement('p');
    paragraph.append(document.createElement('br'));
    element.replaceChildren(paragraph);
    setCaretToEnd(element);
  }};

  const replaceRichText = (element, value) => {{
    if (siteLabel === 'kimi') {{
      const paragraph = document.createElement('p');
      paragraph.append(document.createTextNode(value));
      element.replaceChildren(paragraph);
      setCaretToEnd(element);
      return;
    }}

    element.textContent = '';
    element.append(document.createTextNode(value));
    setCaretToEnd(element);
  }};

  const tryExecInsertText = (element, value) => {{
    try {{
      element.focus();
      element.click?.();
      setCaretToEnd(element);
      document.execCommand?.('selectAll', false);
      document.execCommand?.('delete', false);
      return !!document.execCommand?.('insertText', false, value);
    }} catch (_error) {{
      return false;
    }}
  }};

  const setNativeValue = (element, value) => {{
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, value);
    if (element._valueTracker) {{
      element._valueTracker.setValue('');
    }}
  }};

  const setTextControlValue = (element, value) => {{
    setNativeValue(element, value);
    dispatchInput(element, value);
    element.selectionStart = element.selectionEnd = element.value.length;
  }};

  const typeTextareaByChunks = async (element, value, chunkSize = 14) => {{
    setNativeValue(element, '');
    dispatchInput(element, '');
    await sleep(40);

    for (let index = 0; index < value.length; index += chunkSize) {{
      const chunk = value.slice(index, index + chunkSize);
      setNativeValue(element, `${{element.value}}${{chunk}}`);
      dispatchInput(element, chunk);
      await sleep(28);
    }}

    element.selectionStart = element.selectionEnd = element.value.length;
  }};

  const clickElement = (element) => {{
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const base = {{
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      view: window
    }};

    element.dispatchEvent(new MouseEvent('mouseenter', {{ ...base, buttons: 0 }}));
    element.dispatchEvent(new MouseEvent('mousedown', {{ ...base, buttons: 1, button: 0 }}));
    element.dispatchEvent(new MouseEvent('mouseup', {{ ...base, buttons: 0, button: 0 }}));
    element.dispatchEvent(new MouseEvent('click', {{ ...base, buttons: 0, button: 0 }}));
    element.click?.();
  }};

  const isElementVisible = (element) => {{
    if (!element || !element.isConnected) {{
      return false;
    }}

    const style = window.getComputedStyle?.(element);
    if (style) {{
      if (style.display === 'none' || style.visibility === 'hidden') {{
        return false;
      }}

      if (Number(style.opacity || '1') === 0) {{
        return false;
      }}
    }}

    const rect = element.getBoundingClientRect?.();
    return !rect || (rect.width > 0 && rect.height > 0);
  }};

  const isElementDisabled = (element) =>
    !element ||
    element.disabled ||
    element.getAttribute?.('aria-disabled') === 'true' ||
    element.classList?.contains('disabled');

  const isRichEditorElement = (element) =>
    !!(
      element &&
      (
        element.isContentEditable ||
        element.getAttribute?.('contenteditable') === 'true' ||
        element.getAttribute?.('role') === 'textbox' ||
        element.matches?.('[data-lexical-editor="true"]')
      )
    );

  const decodeBase64 = (value) => {{
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {{
      bytes[index] = binary.charCodeAt(index);
    }}
    return bytes;
  }};

  const makeFiles = () =>
    attachments.map((attachment, index) => {{
      const bytes = decodeBase64(attachment.base64);
      const blob = new Blob([bytes], {{ type: attachment.mimeType || 'application/octet-stream' }});
      return new File([blob], attachment.name || `attachment-${{index + 1}}`, {{
        type: attachment.mimeType || 'application/octet-stream',
        lastModified: Date.now()
      }});
    }});

  const fileMatchesInput = (input, file) => {{
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') {{
      return false;
    }}

    const accept = input.getAttribute('accept') || '';
    if (!accept.trim()) {{
      return true;
    }}

    const accepted = accept
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (!accepted.length) {{
      return true;
    }}

    const fileName = (file.name || '').toLowerCase();
    const mimeType = (file.type || '').toLowerCase();
    return accepted.some((rule) => {{
      if (rule === '*/*') return true;
      if (rule.endsWith('/*')) {{
        return mimeType.startsWith(rule.slice(0, -1));
      }}
      if (rule.startsWith('.')) {{
        return fileName.endsWith(rule);
      }}
      return mimeType === rule;
    }});
  }};

  const assignFilesToInput = (input, files) => {{
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
    input.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
  }};

  const uploadAttachments = async (anchor, deadline) => {{
    if (!attachments.length) {{
      return 'none';
    }}

    const files = makeFiles();
    const resolved = await ensureFileInputs(anchor, deadline);
    const fileInputs = resolved.fileInputs;
    if (!fileInputs.length) {{
      throw new Error('no file input found');
    }}

    let assignedCount = 0;
    for (const input of fileInputs) {{
      const acceptedFiles = input.multiple
        ? files.filter((file) => fileMatchesInput(input, file))
        : files.filter((file) => fileMatchesInput(input, file)).slice(0, 1);

      if (!acceptedFiles.length) {{
        continue;
      }}

      assignFilesToInput(input, acceptedFiles);
      assignedCount += acceptedFiles.length;
      await sleepWithin(120, deadline);

      if (input.multiple || assignedCount >= files.length) {{
        break;
      }}
    }}

    if (assignedCount === 0) {{
      throw new Error('no compatible file input found');
    }}

    return `uploaded:${{assignedCount}}:${{resolved.openedBy}}`;
  }};

  const collectComposerRoots = (anchor) =>
    [...new Set([
      anchor?.closest?.('form'),
      anchor?.closest?.('[class*="composer"]'),
      anchor?.closest?.('[class*="input"]'),
      anchor?.closest?.('[class*="footer"]'),
      anchor?.closest?.('[class*="chat"]'),
      anchor?.closest?.('[class*="toolbar"]'),
      anchor?.closest?.('[class*="action"]'),
      anchor?.parentElement,
      document.body,
      document.documentElement
    ].filter(Boolean))];

  const collectDeepMatches = (root, predicate, includeRoot = false) => {{
    const matches = [];
    const visited = new Set();
    const queue = [root];

    while (queue.length) {{
      const current = queue.shift();
      if (!current || visited.has(current)) {{
        continue;
      }}

      visited.add(current);

      if (includeRoot && current instanceof Element && predicate(current)) {{
        matches.push(current);
      }}

      if (current instanceof Document || current instanceof DocumentFragment || current instanceof ShadowRoot) {{
        const children = current.children ? Array.from(current.children) : [];
        queue.push(...children);
      }} else if (current instanceof Element) {{
        if (predicate(current)) {{
          matches.push(current);
        }}

        queue.push(...Array.from(current.children || []));
      }}

      if (current instanceof Element && current.shadowRoot) {{
        queue.push(current.shadowRoot);
      }}
    }}

    return matches;
  }};

  const collectFileInputs = (anchor) => {{
    const seen = new Set();
    const inputs = [];

    const addFromRoot = (root) => {{
      collectDeepMatches(
        root,
        (element) => element instanceof HTMLInputElement && element.type === 'file'
      ).forEach((input) => {{
        if (!input || seen.has(input) || isElementDisabled(input)) {{
          return;
        }}

        seen.add(input);
        inputs.push(input);
      }});
    }};

    for (const root of collectComposerRoots(anchor)) {{
      addFromRoot(root);
    }}

    if (!inputs.length) {{
      addFromRoot(document);
    }}

    return inputs;
  }};

  const attachPattern =
    /attach|upload|file|image|photo|media|paperclip|plus|add|\u9644\u4ef6|\u4e0a\u4f20|\u6587\u4ef6|\u56fe\u7247|\u56fe\u50cf|\u6dfb\u52a0/iu;

  const isAttachTrigger = (element) => {{
    if (!(element instanceof HTMLElement) || isElementDisabled(element) || !isElementVisible(element)) {{
      return false;
    }}

    if (
      !element.matches?.('button, [role="button"], label, summary, div, span') &&
      !element.hasAttribute?.('tabindex')
    ) {{
      return false;
    }}

    const label = [
      element.getAttribute?.('aria-label') || '',
      element.getAttribute?.('title') || '',
      element.getAttribute?.('data-testid') || '',
      element.getAttribute?.('name') || '',
      element.id || '',
      typeof element.className === 'string' ? element.className : '',
      element.textContent || ''
    ].join(' ');

    return attachPattern.test(label);
  }};

  const collectAttachTriggers = (anchor) => {{
    const seen = new Set();
    const triggers = [];
    const siteSelectors = {{
      gemini: [
        "button[aria-label*='Upload']",
        "button[aria-label*='Attach']",
        "button[mattooltip*='Upload']",
        "button[mattooltip*='Attach']",
        "[data-testid*='upload']",
        "[data-test-id*='upload']"
      ],
      kimi: [
        "button[aria-label*='Upload']",
        "button[aria-label*='Attach']",
        "[data-testid*='upload']",
        "[class*='upload']",
        "[class*='attach']"
      ],
      qwen: [
        "button[aria-label*='Upload']",
        "button[aria-label*='Attach']",
        "[data-testid*='upload']",
        "[class*='upload']",
        "[class*='attach']"
      ]
    }};

    const addTrigger = (element) => {{
      if (!element || seen.has(element) || !isAttachTrigger(element)) {{
        return;
      }}

      seen.add(element);
      triggers.push(element);
    }};

    for (const root of collectComposerRoots(anchor)) {{
      const selectors = [
        ...(siteSelectors[siteLabel] || []),
        "button",
        "[role='button']",
        "label",
        "[tabindex]"
      ];

      for (const selector of selectors) {{
        collectDeepMatches(
          root,
          (element) => element instanceof Element && element.matches?.(selector)
        ).forEach(addTrigger);
      }}
    }}

    return triggers;
  }};

  const ensureFileInputs = async (anchor, deadline) => {{
    let fileInputs = collectFileInputs(anchor);
    if (fileInputs.length) {{
      return {{
        fileInputs,
        openedBy: 'existing'
      }};
    }}

    for (const trigger of collectAttachTriggers(anchor)) {{
      clickElement(trigger);
      await sleepWithin(90, deadline);

      fileInputs = collectFileInputs(anchor);
      if (fileInputs.length) {{
        return {{
          fileInputs,
          openedBy: 'trigger'
        }};
      }}

      for (const nestedTrigger of collectAttachTriggers(anchor)) {{
        if (nestedTrigger === trigger) {{
          continue;
        }}

        clickElement(nestedTrigger);
        await sleepWithin(90, deadline);
        fileInputs = collectFileInputs(anchor);
        if (fileInputs.length) {{
          return {{
            fileInputs,
            openedBy: 'nested-trigger'
          }};
        }}
      }}
    }}

    return {{
      fileInputs: collectFileInputs(anchor),
      openedBy: 'none'
    }};
  }};

  const findPromptInput = () => {{
    for (const selector of inputSelectors) {{
      const candidate = document.querySelector(selector);
      if (candidate) {{
        return {{
          element: candidate,
          selector
        }};
      }}
    }}

    return null;
  }};

  const busyPattern =
    /uploading|loading|pending|processing|progress|spinner|transferring|syncing|sending|analy(?:zing|sing)|generating|\u4e0a\u4f20\u4e2d|\u52a0\u8f7d\u4e2d|\u5904\u7406\u4e2d|\u5206\u6790\u4e2d|\u53d1\u9001\u4e2d|\u8bf7\u7a0d\u5019/iu;

  const elementLooksBusy = (element) => {{
    if (!element) {{
      return false;
    }}

    if (element.getAttribute?.('aria-busy') === 'true') {{
      return true;
    }}

    if (element.tagName === 'PROGRESS') {{
      return true;
    }}

    const label = [
      element.getAttribute?.('data-state') || '',
      element.getAttribute?.('data-status') || '',
      element.getAttribute?.('data-testid') || '',
      element.getAttribute?.('aria-label') || '',
      element.getAttribute?.('title') || '',
      element.id || '',
      typeof element.className === 'string' ? element.className : '',
      element.textContent || ''
    ].join(' ');

    return busyPattern.test(label);
  }};

  const findBusyIndicators = (anchor) => {{
    const roots = collectComposerRoots(anchor);
    const seen = new Set();
    const indicators = [];
    const selectors = [
      '[aria-busy="true"]',
      '[role="progressbar"]',
      'progress',
      '[data-state*="upload"]',
      '[data-state*="loading"]',
      '[data-state*="pending"]',
      '[data-state*="process"]',
      '[data-status*="upload"]',
      '[data-status*="loading"]',
      '[data-status*="pending"]',
      '[data-status*="process"]',
      '[data-testid*="upload"]',
      '[data-testid*="progress"]',
      '[data-testid*="loading"]',
      '[class*="uploading"]',
      '[class*="progress"]',
      '[class*="loading"]',
      '[class*="pending"]',
      '[class*="spinner"]',
      '[class*="processing"]',
      '[id*="upload"]',
      '[id*="progress"]',
      '[id*="loading"]'
    ];

    for (const root of roots) {{
      for (const selector of selectors) {{
        root.querySelectorAll?.(selector).forEach((element) => {{
          if (!element || seen.has(element) || !isElementVisible(element) || !elementLooksBusy(element)) {{
            return;
          }}

          seen.add(element);
          indicators.push(element);
        }});
      }}
    }}

    return indicators;
  }};

  const waitForUploadToSettle = async (anchor, deadline) => {{
    if (!attachments.length) {{
      return 'skipped';
    }}

    const root = collectComposerRoots(anchor)[0] || document.body;
    let lastMutationAt = Date.now();
    let mutationCount = 0;
    const observer =
      root && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {{
            mutationCount += 1;
            lastMutationAt = Date.now();
          }})
        : null;

    observer?.observe(root, {{
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    }});

    const startedAt = Date.now();
    let settledBy = 'timeout';

    while (Date.now() < deadline) {{
      const busyCount = findBusyIndicators(anchor).length;
      const quietFor = Date.now() - lastMutationAt;
      const assignedFiles = collectFileInputs(anchor).reduce(
        (total, input) => total + (input.files?.length || 0),
        0
      );

      if (
        assignedFiles > 0 &&
        busyCount === 0 &&
        quietFor >= 320 &&
        (mutationCount > 0 || Date.now() - startedAt > 500)
      ) {{
        settledBy = quietFor >= 500 ? 'quiet' : 'ready';
        break;
      }}

      await sleepWithin(120, deadline);
    }}

    observer?.disconnect();
    await sleepWithin(40, deadline);
    return settledBy;
  }};

  const typeIntoElement = async (element, value) => {{
    if (!value) {{
      return;
    }}

    element.focus();
    element.click?.();

    dispatchKeyboard(element, 'keydown', ' ');
    dispatchKeyboard(element, 'keyup', ' ');

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {{
      if (siteLabel === 'doubao' && element instanceof HTMLTextAreaElement) {{
        await typeTextareaByChunks(element, value);
        return;
      }}

      setTextControlValue(element, value);
      return;
    }}

    if (isRichEditorElement(element)) {{
      setCaretToEnd(element);

      if (siteLabel === 'grok') {{
        document.execCommand?.('selectAll', false);
        document.execCommand?.('delete', false);
        const pasted = dispatchClipboardPaste(element, value);
        if (!pasted) {{
          const inserted = tryExecInsertText(element, value);
          if (!inserted) {{
            replaceRichText(element, value);
          }}
        }}
        dispatchInput(element, value);
        return;
      }}

      if (siteLabel === 'gemini') {{
        document.execCommand?.('selectAll', false);
        const inserted = document.execCommand?.('insertText', false, value);
        if (!inserted) {{
          replaceRichText(element, value);
        }}
        dispatchInput(element, value);
        return;
      }}

      if (siteLabel === 'kimi') {{
        const inserted = tryExecInsertText(element, value);
        if (!inserted) {{
          resetRichEditor(element);
          replaceRichText(element, value);
          dispatchPlainInput(element);
        }}
        return;
      }}

      const inserted = tryExecInsertText(element, value);
      if (!inserted) {{
        replaceRichText(element, value);
      }}
      dispatchInput(element, value);
      return;
    }}

    throw new Error('unsupported input element');
  }};

  const collectCandidates = (input) => {{
    const seen = new Set();
    const candidates = [];
    const ancestors = [];
    let current = input;
    for (let depth = 0; depth < 6 && current; depth += 1) {{
      ancestors.push(current);
      current = current.parentElement;
    }}

    const containers = [...new Set([
      input?.closest?.('form'),
      input?.closest?.('[class*="input"]'),
      input?.closest?.('[class*="composer"]'),
      input?.closest?.('[class*="footer"]'),
      input?.closest?.('[class*="chat"]'),
      input?.closest?.('[class*="toolbar"]'),
      input?.closest?.('[class*="action"]'),
      ...ancestors,
      input?.parentElement,
      document
    ].filter(Boolean))];

    const addCandidate = (element, source) => {{
      if (!element || seen.has(element)) return;
      seen.add(element);
      candidates.push({{ element, source }});
    }};

    for (const container of containers) {{
      for (const selector of submitSelectors) {{
        container.querySelectorAll?.(selector).forEach((element) => addCandidate(element, selector));
      }}

      container
        .querySelectorAll?.('button, [role="button"], .send-button-container')
        .forEach((element) => addCandidate(element, 'generic'));
    }}

    return candidates;
  }};

  const findSubmitCandidate = (input, options = {{}}) => {{
    const allowDisabled = options.allowDisabled === true;

    for (const candidate of collectCandidates(input || document.body)) {{
      const button = candidate.element;
      const className = typeof button.className === 'string' ? button.className : '';
      const label = [
        button.getAttribute('aria-label') || '',
        button.getAttribute('title') || '',
        button.textContent || '',
        button.dataset?.testid || '',
        className,
        button.getAttribute('name') || ''
      ].join(' ');

      const hasSendIcon =
        !!button.querySelector?.('.send-icon, svg[name="Send"], [name="Send"]') ||
        button.getAttribute('name') === 'Send';

      const looksLikeSend =
        sendPattern.test(label) ||
        button.dataset?.testid === 'send-button' ||
        button.type === 'submit' ||
        hasSendIcon ||
        (
          siteLabel === 'doubao' &&
          /send-msg-btn|g-send-msg-btn|bg-g-send-msg-btn/.test(className)
        );

      if (!looksLikeSend) continue;
      if (!allowDisabled && isElementDisabled(button)) continue;
      return candidate;
    }}

    return null;
  }};

  const waitForSendReady = async (input, deadline) => {{
    while (Date.now() < deadline) {{
      const busyCount = findBusyIndicators(input).length;
      const candidate = findSubmitCandidate(input, {{ allowDisabled: true }});

      if (busyCount === 0 && (!candidate || !isElementDisabled(candidate.element))) {{
        await sleepWithin(40, deadline);
        return candidate ? 'button-ready' : 'fallback';
      }}

      await sleepWithin(120, deadline);
    }}

    return 'timeout';
  }};

  const clickSubmit = (input) => {{
    const candidate = findSubmitCandidate(input);
    if (!candidate) {{
      return null;
    }}

    candidate.element.focus?.();
    clickElement(candidate.element);
    return candidate.source;
  }};

  const getDoubaoSubmitButton = (input) => {{
    if (!input) {{
      return null;
    }}

    const scopedRoot =
      input.closest('.input-content-container-bMefgL') ||
      input.closest('.relative.z-0') ||
      input.parentElement?.parentElement?.parentElement?.parentElement;

    if (!scopedRoot) {{
      return null;
    }}

    const inputRect = input.getBoundingClientRect?.();
    const candidates = Array.from(
      scopedRoot.querySelectorAll(
        "button[class*='send-msg-btn'], button[class*='g-send-msg-btn'], button[class*='bg-g-send-msg-btn'], [data-testid='chat_input_send_button'], #flow-end-msg-send, .send-btn-DDB6yN, button.semi-button-primary.send-btn-kg0z5d, button, [role='button']",
      ),
    ).filter((element) => {{
      if (!element) {{
        return false;
      }}

      if (isElementDisabled(element)) {{
        return false;
      }}

      const className = typeof element.className === 'string' ? element.className : '';
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width < 28 || rect.height < 28 || rect.width > 44 || rect.height > 44) {{
        return false;
      }}

      const isSendLike = /send-msg-btn|g-send-msg-btn|bg-g-send-msg-btn|rounded-full|size-36|bg-dbx-text-highlight/i.test(
        className,
      );
      if (!isSendLike) {{
        return false;
      }}

      if (element.textContent?.trim()) {{
        return false;
      }}

      if (inputRect && rect.left < inputRect.left + 8) {{
        return false;
      }}

      return true;
    }});

    return candidates.at(-1) || null;
  }};

  const trySubmit = async (input, deadline) => {{
    if (siteLabel === 'doubao' && input) {{
      const directButton = getDoubaoSubmitButton(input);
      if (directButton) {{
        clickElement(directButton);
        await sleepWithin(120, deadline);

        const remainingValue = input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement
          ? input.value.trim()
          : input.textContent?.trim() || '';

        if (!remainingValue || remainingValue !== prompt.trim()) {{
          return 'clicked:doubao-direct';
        }}
      }}
    }}

    if (siteLabel === 'grok') {{
      const directButton = document.querySelector(
        "button[aria-label='Send message'], button[aria-label*='Send'], button[data-testid='send-button'], form button[type='submit']"
      );
      if (
        directButton &&
        !directButton.disabled &&
        directButton.getAttribute('aria-disabled') !== 'true'
      ) {{
        clickElement(directButton);
        return 'clicked:grok-direct';
      }}
    }}

    if (siteLabel === 'gemini' && input) {{
      dispatchKeyboard(input, 'keydown', 'Enter');
      dispatchKeyboard(input, 'keypress', 'Enter');
      dispatchKeyboard(input, 'keyup', 'Enter');
      await sleepWithin(80, deadline);

      dispatchKeyboard(input, 'keydown', 'Enter', {{ ctrlKey: true }});
      dispatchKeyboard(input, 'keypress', 'Enter', {{ ctrlKey: true }});
      dispatchKeyboard(input, 'keyup', 'Enter', {{ ctrlKey: true }});
      await sleepWithin(80, deadline);

      dispatchKeyboard(input, 'keydown', 'Enter', {{ metaKey: true }});
      dispatchKeyboard(input, 'keypress', 'Enter', {{ metaKey: true }});
      dispatchKeyboard(input, 'keyup', 'Enter', {{ metaKey: true }});
      await sleepWithin(80, deadline);
    }}

    for (let index = 0; index < 4 && Date.now() < deadline; index += 1) {{
      const source = clickSubmit(input);
      if (source) {{
        return 'clicked:' + source;
      }}
      await sleepWithin(80, deadline);
    }}

    input?.form?.requestSubmit?.();
    await sleepWithin(40, deadline);

    if (input) {{
      dispatchKeyboard(input, 'keydown', 'Enter');
      dispatchKeyboard(input, 'keypress', 'Enter');
      dispatchKeyboard(input, 'keyup', 'Enter');
      if (siteLabel === 'doubao') {{
        await sleepWithin(80, deadline);
        dispatchKeyboard(input, 'keydown', 'Enter', {{ ctrlKey: true }});
        dispatchKeyboard(input, 'keypress', 'Enter', {{ ctrlKey: true }});
        dispatchKeyboard(input, 'keyup', 'Enter', {{ ctrlKey: true }});
        return 'enter+ctrl-enter';
      }}
    }}

    return 'enter';
  }};

  const run = async () => {{
    const deadline = Date.now() + 5000;
    const initialInput = findPromptInput();
    const uploadScope = initialInput?.element || null;
    const uploadMethod = await uploadAttachments(uploadScope, deadline);
    const uploadAnchor =
      collectFileInputs(uploadScope).find((candidate) => (candidate.files?.length || 0) > 0) ||
      uploadScope ||
      null;
    const uploadState = await waitForUploadToSettle(uploadAnchor, deadline);
    let matchedSelector = initialInput?.selector || '';
    let input = initialInput?.element || null;

    if (prompt) {{
      if (!input) {{
        const resolvedInput = findPromptInput();
        input = resolvedInput?.element || null;
        matchedSelector = resolvedInput?.selector || '';
      }}

      if (input) {{
        await typeIntoElement(input, prompt);
        await sleepWithin(siteLabel === 'kimi' ? 180 : 120, deadline);
      }}

      if (!input) {{
        throw new Error('no supported input selector matched');
      }}
    }} else {{
      if (!input) {{
        input = document.querySelector(inputSelectors[0]) || null;
        matchedSelector = inputSelectors[0] || '';
      }}
      await sleepWithin(120, deadline);
    }}

    if (!shouldSubmit) {{
      return `ok:${{matchedSelector || 'no-text-input'}}:${{uploadMethod}}:${{uploadState}}:injected-only`;
    }}

    const readyState = await waitForSendReady(input || uploadAnchor, deadline);
    const method = await trySubmit(input, deadline);
    return `ok:${{matchedSelector || 'no-text-input'}}:${{uploadMethod}}:${{uploadState}}:${{readyState}}:${{method}}`;
  }};

  run().catch((error) => {{
    console.error(error);
  }});
}})();
"#,
        site_label = serde_json::to_string(site.label).expect("label should serialize"),
        prompt_json = prompt_json,
        input_selectors = inputs,
        submit_selectors = submits,
        attachments_json = attachments_json,
        should_submit_json = should_submit_json
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_page_load(|webview, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }

            let label = webview.label();
            if find_site(label).is_none() {
                return;
            }

            let _ = webview.app_handle().emit(
                SITE_AVAILABILITY_SYNC_EVENT,
                SiteAvailabilityEvent {
                    label: label.to_string(),
                    available: true,
                    message: String::new(),
                },
            );
        })
        .invoke_handler(tauri::generate_handler![
            list_sites,
            broadcast_prompt,
            inject_attachments,
            reload_webviews,
            probe_site_availability,
            read_file_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
