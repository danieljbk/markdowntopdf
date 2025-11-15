import { marked } from 'marked';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const markdownInput = document.getElementById('markdown-input');
const previewOutput = document.getElementById('preview-output');
const previewScroll = document.querySelector('.preview-scroll');
const previewBtn = document.getElementById('preview-btn');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const statusMessage = document.getElementById('status-message');

if (
  !(markdownInput instanceof HTMLTextAreaElement) ||
  !(previewOutput instanceof HTMLElement) ||
  !(previewScroll instanceof HTMLElement) ||
  !(previewBtn instanceof HTMLButtonElement) ||
  !(downloadBtn instanceof HTMLButtonElement) ||
  !(clearBtn instanceof HTMLButtonElement) ||
  !(statusMessage instanceof HTMLDivElement)
) {
  throw new Error('Markdown converter elements not found');
}

type StatusType = 'success' | 'error' | 'info';

function showStatus(message: string, type: StatusType) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type} visible`;
  setTimeout(() => {
    statusMessage.classList.remove('visible');
  }, 3000);
}

function renderPreview(markdown: string) {
  if (!markdown.trim()) {
    previewOutput.innerHTML = '<p class="empty-state">No content to preview. Start typing in the editor.</p>';
    return;
  }

  const html = marked.parse(markdown);
  previewOutput.innerHTML = html;
  renderMathInElement(previewOutput, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
    ],
    throwOnError: false,
  });
  attachLinkEnhancements();
}

function previewMarkdown() {
  try {
    renderPreview(markdownInput.value);
    showStatus('Preview updated', 'success');
  } catch (error) {
    console.error('Preview error:', error);
    const message = error instanceof Error ? error.message : String(error);
    showStatus('Error generating preview', 'error');
    previewOutput.innerHTML = `<p class="error-state">Error: ${message}</p>`;
  }
}

function clearInput() {
  if (confirm('Clear all content?')) {
    markdownInput.value = '';
    previewOutput.innerHTML = '<p class="empty-state">No content to preview. Start typing in the editor.</p>';
    showStatus('Content cleared', 'info');
  }
}

previewBtn.addEventListener('click', previewMarkdown);
clearBtn.addEventListener('click', clearInput);

markdownInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    previewMarkdown();
  }
});

downloadBtn.addEventListener('click', () => {
  try {
    renderPreview(markdownInput.value);
    showStatus('Opening print dialog…', 'info');
    requestAnimationFrame(() => {
      window.print();
    });
  } catch (error) {
    console.error('Print error:', error);
    const message = error instanceof Error ? error.message : String(error);
    showStatus(`Unable to print: ${message}`, 'error');
  }
});

function attachLinkEnhancements() {
  const anchors = previewOutput.querySelectorAll<HTMLAnchorElement>('a[href]');

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }

    if (href.startsWith('#')) {
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        scrollToHeading(href);
      });
    } else if (href.startsWith('http') || href.startsWith('https')) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function scrollToHeading(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) return;

  const target = previewOutput.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (!target) return;

  const targetRect = target.getBoundingClientRect();
  const scrollRect = previewScroll.getBoundingClientRect();
  const offset = targetRect.top - scrollRect.top + previewScroll.scrollTop - 16;

  previewScroll.scrollTo({
    top: Math.max(offset, 0),
    behavior: 'smooth',
  });
}

function makeInternalLinksAbsolute() {
  const anchors = previewOutput.querySelectorAll<HTMLAnchorElement>('a[data-original-href], a[href^="#"]');
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('#')) {
      return;
    }
    anchor.dataset.originalHref = href;
    const absolute = `${window.location.origin}${window.location.pathname}${href}`;
    anchor.setAttribute('href', absolute);
  });
}

function restoreInternalLinks() {
  const anchors = previewOutput.querySelectorAll<HTMLAnchorElement>('a[data-original-href]');
  anchors.forEach((anchor) => {
    const original = anchor.dataset.originalHref;
    if (!original) return;
    anchor.setAttribute('href', original);
    delete anchor.dataset.originalHref;
  });
}

window.addEventListener('beforeprint', () => {
  makeInternalLinksAbsolute();
});

window.addEventListener('afterprint', () => {
  restoreInternalLinks();
});

async function loadInitialContent() {
  if (markdownInput.value.trim()) {
    renderPreview(markdownInput.value);
    return;
  }

  try {
    const response = await fetch('/example.md');
    if (!response.ok) {
      throw new Error(`Unable to load example (HTTP ${response.status})`);
    }
    const text = await response.text();
    markdownInput.value = text;
    renderPreview(text);
    showStatus('Loaded example document', 'info');
  } catch (error) {
    console.warn('Example load failed:', error);
    if (!markdownInput.value.trim() && markdownInput.placeholder) {
      markdownInput.value = markdownInput.placeholder;
      renderPreview(markdownInput.value);
    }
  }
}

loadInitialContent();

export {};

