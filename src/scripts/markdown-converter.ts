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

const previewOutputEl = document.getElementById('preview-output')
const downloadBtn = document.getElementById('download-btn')
const statusMessageEl = document.getElementById('status-message')
const syncCheckboxEl = document.getElementById('sync-scroll-checkbox')

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

const previewOutput: HTMLElement = previewOutputEl
const statusMessage: HTMLDivElement = statusMessageEl
const syncCheckbox: HTMLInputElement = syncCheckboxEl

type StatusType = 'success' | 'error' | 'info'

const localStorageNamespace = 'com.md2pdf'
const localStorageContentKey = `${localStorageNamespace}:last_state`
const localStorageScrollKey = `${localStorageNamespace}:scroll_sync`
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

const editor = createEditor()

const lastContent = loadLastContent()
if (lastContent) {
  presetValue(lastContent)
} else {
  presetValue(defaultInput)
  loadExampleDocument()
}

downloadBtn.addEventListener('click', triggerPrint)
setupResetButton()
setupCopyButton()
initScrollBarSync(loadScrollBarSettings())
setupDivider()

function createEditor() {
  const editorElement = document.getElementById('editor')
  if (!(editorElement instanceof HTMLElement)) {
    throw new Error('Editor container not found')
  }

  const instance = monaco.editor.create(editorElement, {
    value: '',
    language: 'markdown',
    theme: 'md2pdf-dark',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
    renderLineHighlight: 'all',
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

function triggerPrint() {
  try {
    renderPreview(editor.getValue())
    showStatus('Opening print dialog…', 'info')
    requestAnimationFrame(() => {
      window.print()
    })
  } catch (error) {
    console.error('Print error:', error)
    const message = error instanceof Error ? error.message : String(error)
    showStatus(`Unable to print: ${message}`, 'error')
  }
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
