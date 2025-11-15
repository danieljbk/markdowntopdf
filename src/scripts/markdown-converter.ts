import * as monaco from 'monaco-editor'
import { marked } from 'marked'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - katex auto-render has no bundled type declarations
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'

marked.setOptions({
  breaks: true,
  gfm: true,
})

// Public URL of the Cloudflare Browser Rendering worker endpoint.
// Configure this in your Astro env as PUBLIC_WORKER_PDF_URL, e.g.:
// PUBLIC_WORKER_PDF_URL="https://your-worker-subdomain.workers.dev/render-pdf"
const WORKER_PDF_URL =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  (import.meta.env as any).PUBLIC_WORKER_PDF_URL
    ? (import.meta.env as any).PUBLIC_WORKER_PDF_URL
    : ''

const previewOutputEl = document.getElementById('preview-output')
const downloadBtn = document.getElementById('download-btn')
const statusMessageEl = document.getElementById('status-message')
const syncCheckboxEl = document.getElementById('sync-scroll-checkbox')
const appShellEl = document.getElementById('app-shell')
const themeSelectEl = document.getElementById('theme-select')

if (!(previewOutputEl instanceof HTMLElement)) {
  throw new Error('Preview output element not found')
}
if (!(downloadBtn instanceof HTMLButtonElement)) {
  throw new Error('Download button not found')
}
if (!(statusMessageEl instanceof HTMLDivElement)) {
  throw new Error('Status message element not found')
}
if (!(syncCheckboxEl instanceof HTMLInputElement)) {
  throw new Error('Sync scroll checkbox not found')
}
if (!(appShellEl instanceof HTMLElement)) {
  throw new Error('App shell element not found')
}
if (!(themeSelectEl instanceof HTMLSelectElement)) {
  throw new Error('Theme select element not found')
}

const previewOutput: HTMLElement = previewOutputEl
const statusMessage: HTMLDivElement = statusMessageEl
const syncCheckbox: HTMLInputElement = syncCheckboxEl
const appShell: HTMLElement = appShellEl
const themeSelect: HTMLSelectElement = themeSelectEl

type StatusType = 'success' | 'error' | 'info'

const localStorageNamespace = 'com.md2pdf'
const localStorageContentKey = `${localStorageNamespace}:last_state`
const localStorageScrollKey = `${localStorageNamespace}:scroll_sync`
const localStorageThemeKey = `${localStorageNamespace}:theme`
const confirmationMessage =
  'Are you sure you want to reset? Your changes will be lost.'
const emptyStateHtml =
  '<p class="empty-state">No content to preview. Start typing in the editor.</p>'
const defaultInput = `# Start typing your Markdown here...

## Features
- **Bold text**
- *Italic text*
- [Links](https://example.com)
- \`Code\`

### Tables
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |

> Blockquotes work too!
`

let hasEdited = false
let scrollBarSync = false

type ThemeId = 'laetus' | 'githubDark' | 'githubLight'
let currentTheme: ThemeId = 'laetus'
let laetusThemeLoaded = false

declare const self: any

self.MonacoEnvironment = {
  getWorker() {
    return new Proxy(
      {},
      {
        get() {
          return () => {}
        },
      }
    )
  },
}

const editor = createEditor()

const lastContent = loadLastContent()
if (lastContent) {
  presetValue(lastContent)
} else {
  presetValue(defaultInput)
  loadExampleDocument()
}

downloadBtn.addEventListener('click', () => {
  void triggerPrint()
})
setupResetButton()
setupCopyButton()
initScrollBarSync(loadScrollBarSettings())
setupDivider()
initTheme()

function createEditor() {
  const editorElement = document.getElementById('editor')
  if (!(editorElement instanceof HTMLElement)) {
    throw new Error('Editor container not found')
  }

  const instance = monaco.editor.create(editorElement, {
    value: '',
    language: 'markdown',
    theme: 'vs-dark',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
    renderLineHighlight: 'all',
    padding: {
      top: 24,
      bottom: 24,
    },
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
    },
    hover: { enabled: false },
    quickSuggestions: false,
    folding: false,
  })

  instance.onDidChangeModelContent(() => {
    const value = instance.getValue()
    const changed = value !== defaultInput
    if (changed) {
      hasEdited = true
    }
    convert(value)
  })

  instance.onDidScrollChange((event) => {
    if (!scrollBarSync) {
      return
    }

    const layoutInfo = instance.getLayoutInfo()
    const maxScrollTop = Math.max(event.scrollHeight - layoutInfo.height, 1)
    const scrollRatio = event.scrollTop / maxScrollTop

    const previewColumn = document.getElementById('preview')
    if (previewColumn) {
      const targetY =
        (previewColumn.scrollHeight - previewColumn.clientHeight) * scrollRatio
      previewColumn.scrollTo({ top: targetY, behavior: 'auto' })
    }
  })

  instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    previewMarkdown()
  })

  return instance
}

function initTheme() {
  const stored = loadThemePreference()
  const initial: ThemeId = stored ?? 'laetus'
  currentTheme = initial
  themeSelect.value = initial
  applyTheme(initial)

  themeSelect.addEventListener('change', (event) => {
    const target = event.currentTarget as HTMLSelectElement
    const value = (target.value as ThemeId) || 'laetus'
    applyTheme(value)
  })
}

function applyTheme(theme: ThemeId) {
  currentTheme = theme
  if (theme === 'laetus') {
    ensureLaetusThemeLoaded().then(() => {
      monaco.editor.setTheme('laetus-black')
    })
  } else if (theme === 'githubDark') {
    defineGithubTheme()
    monaco.editor.setTheme('md2pdf-dark')
  } else {
    // GitHub Light uses Monaco's built-in light theme.
    monaco.editor.setTheme('vs')
  }

  appShell.classList.remove(
    'theme-laetus',
    'theme-github',
    'theme-github-light'
  )
  if (theme === 'laetus') {
    appShell.classList.add('theme-laetus')
  } else if (theme === 'githubDark') {
    appShell.classList.add('theme-github')
  } else {
    appShell.classList.add('theme-github-light')
  }
  saveThemePreference(theme)
  updateMarkdownThemeCss(theme)
}

function getMarkdownThemeCss(theme: ThemeId): string {
  // Shared markdown layout is provided by github-markdown-css; this function
  // contains ONLY theme-specific overrides so preview and PDF stay in sync.
  if (theme === 'laetus') {
    return [
      'body { background: #0a0a0a; color: #f8f8f0; }',
      '.markdown-body { background: #0a0a0a; color: #f8f8f0; padding-bottom: 2rem; }',
      '.markdown-body a { color: #40c4ff; }',
      '.markdown-body a:hover { text-decoration: underline; }',
      '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { color: #ff5252; }',
      '.markdown-body blockquote { color: #b2ff59; border-left-color: #b2ff59; }',
      '.markdown-body pre { background-color: #141414; border-radius: 8px; }',
      '.markdown-body table { background: #0a0a0a; border-collapse: collapse; }',
      '.markdown-body table th, .markdown-body table td { border: 1px solid #2a2a2a; }',
      '.markdown-body table th { background: #050506; color: #f8f8f0; }',
      '.markdown-body table td { background: #0a0a0a; }',
      '.markdown-body code { color: #40c4ff; background-color: #141414; }',
      '.markdown-body pre code { color: #f8f8f0; }',
    ].join('\n')
  }

  if (theme === 'githubLight') {
    return [
      'body { background: #ffffff; color: #24292f; }',
      '.markdown-body { background: #ffffff; color: #24292f; padding-bottom: 2rem; }',
      '.markdown-body a { color: #0969da; }',
      '.markdown-body a:hover { text-decoration: underline; }',
      '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { color: #1f2328; }',
      '.markdown-body blockquote { color: #57606a; border-left-color: #d0d7de; }',
      '.markdown-body pre { background-color: #f6f8fa; border-radius: 6px; }',
      '.markdown-body table { background: #ffffff; border-collapse: collapse; }',
      '.markdown-body table th, .markdown-body table td { border: 1px solid #d0d7de; }',
      '.markdown-body table th { background: #f6f8fa; }',
      '.markdown-body table td { background: #ffffff; }',
      '.markdown-body code { color: #24292f; background-color: rgba(175, 184, 193, 0.2); }',
    ].join('\n')
  }

  // Default: GitHub Dark
  return [
    'body { background: #0d1117; color: #c9d1d9; }',
    '.markdown-body { background: #0d1117; color: #c9d1d9; padding-bottom: 2rem; }',
    '.markdown-body a { color: #58a6ff; }',
    '.markdown-body a:hover { text-decoration: underline; }',
    '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { color: #e6edf3; }',
    '.markdown-body blockquote { color: #8b949e; border-left-color: #30363d; }',
    '.markdown-body pre { background-color: #161b22; border-radius: 8px; }',
    '.markdown-body table { background: #0d1117; border-collapse: collapse; }',
    '.markdown-body table th, .markdown-body table td { border: 1px solid #30363d; }',
    '.markdown-body table th { background: #161b22; }',
    '.markdown-body table td { background: #0d1117; }',
    '.markdown-body code { color: #c9d1d9; background-color: #161b22; }',
  ].join('\n')
}

function updateMarkdownThemeCss(theme: ThemeId) {
  if (typeof document === 'undefined') return
  let styleEl = document.getElementById(
    'markdown-theme'
  ) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'markdown-theme'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = getMarkdownThemeCss(theme)
}

function defineGithubTheme() {
  monaco.editor.defineTheme('md2pdf-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'c9d1d9', background: '0d1117' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'comment', foreground: '8b949e' },
      { token: 'variable', foreground: 'e6edf3' },
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#c9d1d9',
      'editorLineNumber.foreground': '#6e7681',
      'editorLineNumber.activeForeground': '#c9d1d9',
      'editorCursor.foreground': '#58a6ff',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#161b22',
      'editorGutter.background': '#0d1117',
      'editorLineNumber.background': '#0d1117',
      'editorIndentGuide.background': '#21262d',
      'editorIndentGuide.activeBackground': '#3b4148',
    },
  })
}

async function ensureLaetusThemeLoaded() {
  if (laetusThemeLoaded) return
  try {
    const response = await fetch('/laetus-blk-color-theme.json')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const rawText = await response.text()
    // Theme file is JSON with occasional line comments starting with //.
    const cleanedText = rawText.replace(/^\s*\/\/.*$/gm, '')
    const theme = JSON.parse(cleanedText) as {
      tokenColors?: {
        scope?: string | string[]
        settings: {
          foreground?: string
          background?: string
          fontStyle?: string
        }
      }[]
      colors?: Record<string, string>
    }

    const rules: any[] = []
    for (const tc of theme.tokenColors ?? []) {
      const settings = tc.settings || {}
      const scopes =
        tc.scope === undefined
          ? ['']
          : Array.isArray(tc.scope)
          ? tc.scope
          : [tc.scope]

      for (const scope of scopes) {
        const rule: any = { token: scope }
        if (settings.foreground) {
          rule.foreground = settings.foreground.replace(/^#/, '')
        }
        if (settings.background) {
          rule.background = settings.background.replace(/^#/, '')
        }
        if (settings.fontStyle) {
          rule.fontStyle = settings.fontStyle
        }
        rules.push(rule)
      }
    }

    monaco.editor.defineTheme('laetus-black', {
      base: 'vs-dark',
      inherit: true,
      rules,
      colors: theme.colors ?? {},
    })

    laetusThemeLoaded = true
  } catch (error) {
    console.warn('Error while loading Laetus theme:', error)
  }
}

function saveThemePreference(theme: ThemeId) {
  try {
    localStorage.setItem(localStorageThemeKey, theme)
  } catch {
    // ignore
  }
}

function loadThemePreference(): ThemeId | null {
  try {
    const stored = localStorage.getItem(localStorageThemeKey)
    if (stored === 'laetus') return 'laetus'
    if (stored === 'github' || stored === 'githubDark') return 'githubDark'
    if (stored === 'githubLight') return 'githubLight'
    return null
  } catch {
    return null
  }
}

function convert(markdown: string) {
  renderPreview(markdown)
  saveLastContent(markdown)
}

function renderPreview(markdown: string) {
  if (!markdown.trim()) {
    previewOutput.innerHTML = emptyStateHtml
    return
  }

  const html = marked.parse(markdown)
  previewOutput.innerHTML = html as string

  renderMathInElement(previewOutput, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
    ],
    throwOnError: false,
  })

  attachLinkEnhancements()
}

function previewMarkdown() {
  try {
    renderPreview(editor.getValue())
    showStatus('Preview updated', 'success')
  } catch (error) {
    console.error('Preview error:', error)
    const message = error instanceof Error ? error.message : String(error)
    showStatus('Error generating preview', 'error')
    previewOutput.innerHTML = `<p class="error-state">Error: ${message}</p>`
  }
}

async function triggerPrint() {
  try {
    renderPreview(editor.getValue())

    // If the worker URL is not configured, fall back to the browser's print dialog.
    if (!WORKER_PDF_URL) {
      showStatus('Worker URL not configured, using browser print…', 'info')
      requestAnimationFrame(() => {
        window.print()
      })
      return
    }

    const html = buildHtmlForWorker()
    const filename = createPdfFilename()

    downloadBtn.disabled = true
    showStatus('Generating PDF…', 'info')

    const response = await fetch(WORKER_PDF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html, filename }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('Worker error response:', response.status, text)
      throw new Error(
        `Worker returned HTTP ${response.status}${
          text ? `: ${text.slice(0, 200)}` : ''
        }`
      )
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    showStatus('PDF downloaded', 'success')
  } catch (error) {
    console.error('PDF generation error:', error)
    const message = error instanceof Error ? error.message : String(error)
    showStatus(`Unable to generate PDF: ${message}`, 'error')
  } finally {
    downloadBtn.disabled = false
  }
}

function buildHtmlForWorker(): string {
  const contentHtml = previewOutput.innerHTML

  const baseStyle = [
    'body { margin: 0; padding: 24px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }',
    '.markdown-body { box-sizing: border-box; max-width: 800px; margin: 0 auto; }',
  ]

  const themeCss = getMarkdownThemeCss(currentTheme)

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>Markdown to PDF</title>',
    // Use CDN-hosted styles so the Browser Rendering worker can fetch them.
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown.min.css" />',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />',
    '<style>',
    baseStyle.join('\n'),
    themeCss,
    '</style>',
    '</head>',
    '<body>',
    '<article class="markdown-body">',
    contentHtml,
    '</article>',
    '</body>',
    '</html>',
  ].join('')
}

function createPdfFilename(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `markdown-${yyyy}-${mm}-${dd}.pdf`
}

function showStatus(message: string, type: StatusType) {
  statusMessage.textContent = message
  statusMessage.className = `status-message ${type} visible`
  setTimeout(() => {
    statusMessage.classList.remove('visible')
  }, 3000)
}

function presetValue(value: string) {
  editor.setValue(value)
  editor.revealPosition({ lineNumber: 1, column: 1 })
  editor.focus()
  hasEdited = false
  renderPreview(value)
}

function resetEditor() {
  const changed = editor.getValue() !== defaultInput
  if (hasEdited || changed) {
    const confirmed = window.confirm(confirmationMessage)
    if (!confirmed) {
      return
    }
  }

  presetValue(defaultInput)
  document.querySelectorAll('.column').forEach((column) => {
    ;(column as HTMLElement).scrollTo({ top: 0 })
  })
}

function setupResetButton() {
  const resetButton = document.querySelector('#reset-button a')
  if (!(resetButton instanceof HTMLAnchorElement)) {
    throw new Error('Reset button not found')
  }

  resetButton.addEventListener('click', (event) => {
    event.preventDefault()
    resetEditor()
  })
}

function setupCopyButton() {
  const copyButton = document.querySelector('#copy-button')
  const copyLabel = document.querySelector('#copy-button a')
  if (
    !(copyButton instanceof HTMLElement) ||
    !(copyLabel instanceof HTMLAnchorElement)
  ) {
    throw new Error('Copy button not found')
  }

  copyButton.addEventListener('click', (event) => {
    event.preventDefault()
    copyToClipboard(
      editor.getValue(),
      () => {
        notifyCopied(copyLabel)
        showStatus('Copied to clipboard', 'success')
      },
      () => {
        showStatus('Unable to copy content', 'error')
      }
    )
  })
}

function copyToClipboard(
  text: string,
  successHandler: () => void,
  errorHandler: () => void
) {
  if (!navigator.clipboard) {
    errorHandler()
    return
  }

  navigator.clipboard.writeText(text).then(successHandler).catch(errorHandler)
}

function notifyCopied(labelElement: HTMLAnchorElement) {
  const original = labelElement.textContent || 'Copy'
  labelElement.textContent = 'Copied!'
  setTimeout(() => {
    labelElement.textContent = original
  }, 1000)
}

function initScrollBarSync(settings: unknown) {
  scrollBarSync = Boolean(settings)
  syncCheckbox.checked = scrollBarSync

  syncCheckbox.addEventListener('change', (event) => {
    const target = event.currentTarget as HTMLInputElement
    const checked = target.checked
    scrollBarSync = checked
    saveScrollBarSettings(checked)
  })
}

function setupDivider() {
  const divider = document.getElementById('split-divider')
  const leftPane = document.getElementById('edit')
  const rightPane = document.getElementById('preview')
  const container = document.getElementById('container')
  if (!divider || !leftPane || !rightPane || !container) {
    return
  }

  let isDragging = false
  let lastLeftRatio = 0.5

  divider.addEventListener('mouseenter', () => {
    divider.classList.add('hover')
  })

  divider.addEventListener('mouseleave', () => {
    if (!isDragging) {
      divider.classList.remove('hover')
    }
  })

  divider.addEventListener('mousedown', () => {
    isDragging = true
    divider.classList.add('active')
    document.body.style.cursor = 'col-resize'
  })

  divider.addEventListener('dblclick', () => {
    const containerRect = container.getBoundingClientRect()
    const dividerWidth = divider.offsetWidth
    const halfWidth = (containerRect.width - dividerWidth) / 2
    leftPane.style.width = `${halfWidth}px`
    rightPane.style.width = `${halfWidth}px`
  })

  document.addEventListener('mousemove', (event) => {
    if (!isDragging) return
    document.body.style.userSelect = 'none'
    const containerRect = container.getBoundingClientRect()
    const totalWidth = containerRect.width
    const dividerWidth = divider.offsetWidth
    const offsetX = event.clientX - containerRect.left

    const minWidth = 200
    const maxWidth = totalWidth - minWidth - dividerWidth
    const leftWidth = Math.max(minWidth, Math.min(offsetX, maxWidth))
    leftPane.style.width = `${leftWidth}px`
    rightPane.style.width = `${totalWidth - leftWidth - dividerWidth}px`
    lastLeftRatio = leftWidth / (totalWidth - dividerWidth)
  })

  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    divider.classList.remove('active')
    divider.classList.remove('hover')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  window.addEventListener('resize', () => {
    const containerRect = container.getBoundingClientRect()
    const dividerWidth = divider.offsetWidth
    const availableWidth = containerRect.width - dividerWidth
    const newLeft = availableWidth * lastLeftRatio
    const newRight = availableWidth * (1 - lastLeftRatio)
    leftPane.style.width = `${newLeft}px`
    rightPane.style.width = `${newRight}px`
  })
}

function saveLastContent(content: string) {
  try {
    localStorage.setItem(localStorageContentKey, content)
  } catch {
    // ignore
  }
}

function loadLastContent(): string | null {
  try {
    return localStorage.getItem(localStorageContentKey)
  } catch {
    return null
  }
}

function saveScrollBarSettings(settings: boolean) {
  try {
    localStorage.setItem(localStorageScrollKey, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

function loadScrollBarSettings(): boolean {
  try {
    const stored = localStorage.getItem(localStorageScrollKey)
    return stored ? JSON.parse(stored) : false
  } catch {
    return false
  }
}

async function loadExampleDocument() {
  try {
    const response = await fetch('/example.md')
    if (!response.ok) {
      throw new Error(`Unable to load example (HTTP ${response.status})`)
    }
    const text = await response.text()
    presetValue(text)
    showStatus('Loaded example document', 'info')
  } catch (error) {
    console.warn('Example load failed:', error)
  }
}

function attachLinkEnhancements() {
  const anchors = previewOutput.querySelectorAll<HTMLAnchorElement>('a[href]')
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href')
    if (!href) return

    if (href.startsWith('#')) {
      anchor.addEventListener('click', (event) => {
        event.preventDefault()
        scrollToHeading(href)
      })
    } else if (href.startsWith('http')) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

function scrollToHeading(href: string) {
  const fragment = href.slice(1).trim()
  if (!fragment) return

  const needle = fragment.toLowerCase().replace(/-/g, ' ')
  const headings = previewOutput.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6'
  )

  for (const heading of headings) {
    const text = (heading.textContent || '').trim().toLowerCase()
    if (!text) continue
    const normalizedText = text.replace(/\s+/g, ' ')
    if (normalizedText === needle || normalizedText.startsWith(needle)) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
      break
    }
  }
}

export {}
