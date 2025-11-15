import { marked } from 'marked';
import htmlToPdfmake from 'html-to-pdfmake';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts as typeof pdfMake.vfs;

if (import.meta.env?.DEV) {
  const fontKeys = Object.keys(pdfMake.vfs || {});
  console.debug('pdfmake fonts available:', fontKeys);
}

marked.setOptions({
  breaks: true,
  gfm: true,
});

const markdownInput = document.getElementById('markdown-input');
const previewOutput = document.getElementById('preview-output');
const previewBtn = document.getElementById('preview-btn');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const statusMessage = document.getElementById('status-message');

if (
  !(markdownInput instanceof HTMLTextAreaElement) ||
  !(previewOutput instanceof HTMLDivElement) ||
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

function previewMarkdown() {
  try {
    const markdown = markdownInput.value;

    if (!markdown.trim()) {
      previewOutput.innerHTML = '<p class="empty-state">No content to preview. Start typing in the editor.</p>';
      return;
    }

    const html = marked.parse(markdown);
    previewOutput.innerHTML = html;

    showStatus('Preview updated', 'success');
  } catch (error) {
    console.error('Preview error:', error);
    const message = error instanceof Error ? error.message : String(error);
    showStatus('Error generating preview', 'error');
    previewOutput.innerHTML = `<p class="error-state">Error: ${message}</p>`;
  }
}

function isDataUrl(src: string): boolean {
  return /^data:/i.test(src);
}

function guessMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg') || lower.endsWith('.svgz')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchImageAsDataUrl(src: string): Promise<string> {
  const absoluteUrl = new URL(src, window.location.href).href;
  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${absoluteUrl}`);
  }
  const buffer = await response.arrayBuffer();
  const mime = response.headers.get('content-type') ?? guessMimeType(absoluteUrl);
  const base64 = arrayBufferToBase64(buffer);
  return `data:${mime};base64,${base64}`;
}

async function embedImagesAsDataUrls(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));
  const warnings: string[] = [];

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || isDataUrl(src)) {
        return;
      }

      try {
        const dataUrl = await fetchImageAsDataUrl(src);
        img.setAttribute('src', dataUrl);
      } catch (error) {
        const alt = img.getAttribute('alt') || src;
        const placeholder = doc.createElement('p');
        placeholder.innerHTML = `<em>[Image unavailable: ${alt}]</em>`;
        img.replaceWith(placeholder);
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Image "${alt}" could not be embedded: ${message}`);
      }
    })
  );

  return {
    html: doc.body.innerHTML || html,
    warnings,
  };
}

async function downloadPDF() {
  try {
    const markdown = markdownInput.value;

    if (!markdown.trim()) {
      showStatus('Please enter some Markdown text first', 'error');
      return;
    }

    showStatus('Generating PDF...', 'info');

    const html = marked.parse(markdown);
    const { html: htmlWithEmbeddedImages, warnings } = await embedImagesAsDataUrls(html);

    const pdfContent = htmlToPdfmake(htmlWithEmbeddedImages, {
      window: window
    });

    const docDefinition = {
      content: pdfContent,
      defaultStyle: {
        fontSize: 11,
        font: 'Roboto'
      },
      info: {
        title: 'Markdown Document',
        creator: 'MD2PDF',
      },
      styles: {
        'html-h1': {
          fontSize: 24,
          bold: true,
          margin: [0, 20, 0, 10] as [number, number, number, number]
        },
        'html-h2': {
          fontSize: 20,
          bold: true,
          margin: [0, 15, 0, 8] as [number, number, number, number]
        },
        'html-h3': {
          fontSize: 16,
          bold: true,
          margin: [0, 12, 0, 6] as [number, number, number, number]
        },
        'html-h4': {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 5] as [number, number, number, number]
        },
        'html-h5': {
          fontSize: 12,
          bold: true,
          margin: [0, 8, 0, 4] as [number, number, number, number]
        },
        'html-h6': {
          fontSize: 11,
          bold: true,
          margin: [0, 6, 0, 3] as [number, number, number, number]
        },
        'html-p': {
          margin: [0, 5, 0, 5] as [number, number, number, number]
        },
        'html-ul': {
          margin: [0, 5, 0, 5] as [number, number, number, number]
        },
        'html-ol': {
          margin: [0, 5, 0, 5] as [number, number, number, number]
        },
        'html-table': {
          margin: [0, 10, 0, 10] as [number, number, number, number]
        },
        'html-code': {
          fontSize: 10,
          background: '#f5f5f5'
        },
        'html-blockquote': {
          italics: true,
          margin: [10, 5, 10, 5] as [number, number, number, number],
          color: '#666666'
        }
      },
      pageMargins: [50, 50, 50, 50] as [number, number, number, number]
    };

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `markdown-${timestamp}.pdf`;

    pdfMake.createPdf(docDefinition).download(filename);

    if (warnings.length > 0) {
      showStatus(`PDF downloaded (${warnings.length} image warning${warnings.length > 1 ? 's' : ''})`, 'info');
      console.warn('Image embedding warnings:', warnings);
    } else {
      showStatus(`PDF downloaded: ${filename}`, 'success');
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    const message = error instanceof Error ? error.message : String(error);
    showStatus(`Error generating PDF: ${message}`, 'error');
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
downloadBtn.addEventListener('click', () => {
  void downloadPDF();
});
clearBtn.addEventListener('click', clearInput);

markdownInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    previewMarkdown();
  }
});

if (!markdownInput.value.trim()) {
  markdownInput.value = markdownInput.placeholder;
  setTimeout(() => previewMarkdown(), 100);
}

export {};

