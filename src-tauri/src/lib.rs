use serde::Serialize;
use tauri::{AppHandle, Manager};

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
        accent_color: "#7d8ba8",
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
        url: "https://chat.qwen.ai/",
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
) -> Vec<CommandResult> {
    resolve_targets(targets)
        .iter()
        .map(|site| run_for_webview(&app, site.label, &build_send_script(site, &prompt)))
        .collect()
}

#[tauri::command]
fn reload_webviews(app: AppHandle<tauri::Wry>, targets: Vec<String>) -> Vec<CommandResult> {
    resolve_targets(targets)
        .iter()
        .map(|site| run_for_webview(&app, site.label, "window.location.reload();"))
        .collect()
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

fn build_send_script(site: &SiteConfig, prompt: &str) -> String {
    let prompt_json = serde_json::to_string(prompt).expect("prompt should serialize");
    let inputs = serde_json::to_string(site.input_selectors).expect("inputs should serialize");
    let submits = serde_json::to_string(site.submit_selectors).expect("submits should serialize");

    format!(
        r#"
(() => {{
  const siteLabel = {site_label};
  const prompt = {prompt_json};
  const inputSelectors = {input_selectors};
  const submitSelectors = {submit_selectors};
  const sendPattern = /send|submit|\u53d1\u9001|\u63d0\u4ea4|\u95ee\u4e00\u95ee/iu;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const typeIntoElement = async (element, value) => {{
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
        }}
        dispatchInput(element, value);
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
      input.closest('form'),
      input.closest('[class*="input"]'),
      input.closest('[class*="composer"]'),
      input.closest('[class*="footer"]'),
      input.closest('[class*="chat"]'),
      input.closest('[class*="toolbar"]'),
      input.closest('[class*="action"]'),
      ...ancestors,
      input.parentElement,
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

  const clickSubmit = (input) => {{
    for (const candidate of collectCandidates(input)) {{
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
      if (
        button.disabled ||
        button.getAttribute('aria-disabled') === 'true' ||
        button.classList?.contains('disabled')
      ) continue;
      button.focus?.();
      clickElement(button);
      return candidate.source;
    }}

    return null;
  }};

  const getDoubaoSubmitButton = (input) => {{
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

      if (
        element.disabled ||
        element.getAttribute?.('aria-disabled') === 'true' ||
        element.classList?.contains('disabled')
      ) {{
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

  const trySubmit = async (input) => {{
    if (siteLabel === 'doubao') {{
      const directButton = getDoubaoSubmitButton(input);
      if (directButton) {{
        clickElement(directButton);
        await sleep(180);

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

    if (siteLabel === 'gemini') {{
      dispatchKeyboard(input, 'keydown', 'Enter');
      dispatchKeyboard(input, 'keypress', 'Enter');
      dispatchKeyboard(input, 'keyup', 'Enter');
      await sleep(120);

      dispatchKeyboard(input, 'keydown', 'Enter', {{ ctrlKey: true }});
      dispatchKeyboard(input, 'keypress', 'Enter', {{ ctrlKey: true }});
      dispatchKeyboard(input, 'keyup', 'Enter', {{ ctrlKey: true }});
      await sleep(120);

      dispatchKeyboard(input, 'keydown', 'Enter', {{ metaKey: true }});
      dispatchKeyboard(input, 'keypress', 'Enter', {{ metaKey: true }});
      dispatchKeyboard(input, 'keyup', 'Enter', {{ metaKey: true }});
      await sleep(120);
    }}

    for (let index = 0; index < 8; index += 1) {{
      const source = clickSubmit(input);
      if (source) {{
        return 'clicked:' + source;
      }}
      await sleep(120);
    }}

    input.form?.requestSubmit?.();
    await sleep(80);

    dispatchKeyboard(input, 'keydown', 'Enter');
    dispatchKeyboard(input, 'keypress', 'Enter');
    dispatchKeyboard(input, 'keyup', 'Enter');
    if (siteLabel === 'doubao') {{
      await sleep(120);
      dispatchKeyboard(input, 'keydown', 'Enter', {{ ctrlKey: true }});
      dispatchKeyboard(input, 'keypress', 'Enter', {{ ctrlKey: true }});
      dispatchKeyboard(input, 'keyup', 'Enter', {{ ctrlKey: true }});
      return 'enter+ctrl-enter';
    }}
    return 'enter';
  }};

  const run = async () => {{
    for (const selector of inputSelectors) {{
      const input = document.querySelector(selector);
      if (!input) continue;
      await typeIntoElement(input, prompt);
      await sleep(siteLabel === 'kimi' ? 260 : 160);
      const method = await trySubmit(input);
      return 'ok:' + selector + ':' + method;
    }}

    throw new Error('no supported input selector matched');
  }};

  run().catch((error) => {{
    console.error(error);
  }});
}})();
"#,
        site_label = serde_json::to_string(site.label).expect("label should serialize"),
        prompt_json = prompt_json,
        input_selectors = inputs,
        submit_selectors = submits
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_sites,
            broadcast_prompt,
            reload_webviews
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
