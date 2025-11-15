# Markdown to PDF Conversion on Cloudflare Workers - Research Document

## Project Requirements

### Three Core Incentives (In Priority Order)

1. **Minimize Cost:** Generate PDFs with minimal per-document cost
2. **Visual Quality:** Ensure generated PDFs have no visual flaws
3. **Use Pre-written Logic:** Avoid writing complex custom logic; leverage professional open-source libraries

### Technical Context

- **Platform:** Cloudflare Workers
- **Architecture:** Multi-worker pipeline possible (different languages per worker)
- **Frontend:** Astro on Cloudflare Pages
- **User Flow:** User pastes Markdown text → clicks convert → downloads PDF

---

## Cloudflare Workers Ecosystem

### Supported Languages & Runtimes

#### JavaScript/TypeScript

- **Runtime:** V8 isolate (native support)
- **Node.js APIs:** Available via `nodejs_compat` compatibility flag
- **Limitations:** Not full Node.js - polyfills only, no `child_process`, limited `fs` (virtual)
- **Bundle Limit:** 10MB compressed (paid plan)
- **CPU Limit:** 50ms per request (paid plan)
- **Memory:** 128MB per isolate

#### Python

- **Runtime:** Pyodide (CPython compiled to WebAssembly)
- **Status:** Beta support
- **Package Support:** Pure Python packages + Pyodide-included packages
- **Limitations:** No C extensions without Pyodide build
- **Bundle Size:** Isolated per worker

#### Rust

- **Runtime:** Compiled to WebAssembly via `workers-rs` crate
- **Support Status:** Official
- **Limitations:** Must compile to `wasm32-unknown-unknown` target
- **Use Case:** High-performance operations

#### WebAssembly (WASM)

- **Languages:** C, C++, Go, Kotlin, or any language compiling to WASM
- **Restrictions:** Cloudflare blocks dynamic WASM generation for security
- **Must:** Statically import WASM modules

### Multi-Worker Architecture

Workers can call other Workers written in different languages:

```
Frontend Worker (JavaScript/Astro)
    ↓ HTTP POST
Worker A (Rust) - Markdown parsing
    ↓ HTTP POST
Worker B (Python) - PDF generation
    ↓ Response
User downloads PDF
```

**Benefits:**

- Bundle size isolation (each worker has own limits)
- Language-specific optimization
- Independent scaling
- Separation of concerns

**Costs:**

- Inter-worker latency (minimal, edge network)
- Architectural complexity
- Multiple deployment units

---

## Identified Libraries - Comprehensive Analysis

### JavaScript Ecosystem

#### **pdfmake**

- **Repository:** bpampuch/pdfmake
- **Purpose:** JavaScript PDF generation via document definition objects
- **How It Works:**
  ```javascript
  const docDefinition = {
    content: [
      { text: 'Title', style: 'header' },
      { text: 'Paragraph with bold text', bold: true },
    ],
  }
  pdfMake.createPdf(docDefinition).download()
  ```
- **Input Format:** JSON/JavaScript object defining document structure
- **Output:** Binary PDF
- **Bundle Size:** ~983KB gzipped
- **npm Statistics:** ~500k weekly downloads, 11k GitHub stars
- **Maintenance:** Actively maintained
- **Features:**
  - Complex table support
  - Custom fonts embedding
  - Images (JPEG, PNG)
  - Vector graphics
  - Headers/footers
  - Page breaks
  - Styles and themes
  - Columns and layouts
- **Cloudflare Workers Compatibility:**
  - **Unknown** - Uses Node.js `Buffer` API (may work with `nodejs_compat`)
  - Large bundle size (near 10MB limit after adding other code)
- **Quality:** ✅ High - professional-grade PDF output with full styling
- **Incentive Alignment:**
  - Cost: ✅ ~$0.00001/PDF (CPU time only)
  - Quality: ✅ Professional output
  - Pre-written: ✅ Mature, battle-tested library
- **Critical Issues:**
  - Bundle size may cause deployment issues
  - Node.js API dependencies uncertain

#### **mdpdfmake**

- **Repository:** Hackerbone/mdpdfmake
- **Purpose:** Convert Markdown to pdfmake document definition
- **How It Works:**
  ```javascript
  import { markdownToPdfmake } from 'mdpdfmake'
  const markdown = '# Title\n**Bold text**'
  const pdfmakeDoc = markdownToPdfmake(markdown)
  // Pass to pdfmake
  ```
- **Input:** Markdown string
- **Output:** pdfmake document definition (JSON)
- **Bundle Size:** ~50KB
- **npm Statistics:** Very low adoption (~8 GitHub stars)
- **Maintenance:** Limited activity
- **Features:**
  - Headers (h1-h6)
  - Bold, italic, strikethrough
  - Lists (ordered/unordered)
  - Links
  - Images
  - Code blocks
  - Tables
  - Blockquotes
- **Cloudflare Workers Compatibility:**
  - **Unknown** - Inherits pdfmake compatibility issues
  - Small bundle adds minimal overhead
- **Quality:** ✅ High (delegates to pdfmake)
- **Incentive Alignment:**
  - Cost: ✅ ~$0.00001/PDF
  - Quality: ✅ Via pdfmake
  - Pre-written: ✅ **Complete MD→PDF solution, zero custom logic needed**
- **Dependencies:** Requires pdfmake
- **Risk:** Low adoption means limited production validation

#### **@propra/mdpdfmake**

- **Repository:** propra/mdpdfmake (fork)
- **Purpose:** Browser-compatible fork of mdpdfmake
- **How It Works:** Same as mdpdfmake with browser-specific modifications
- **Bundle Size:** ~50KB + pdfmake
- **npm Statistics:** Lower than parent (fork)
- **Maintenance:** Fork maintenance
- **Features:** Same as mdpdfmake
- **Cloudflare Workers Compatibility:**
  - **Better chance** - Browser-focused may align with Workers environment
  - Workers runtime closer to browser than Node.js
- **Quality:** ✅ Same as pdfmake
- **Incentive Alignment:**
  - Cost: ✅ ~$0.00001/PDF
  - Quality: ✅ Via pdfmake
  - Pre-written: ✅ **Complete solution**
- **Advantage:** Browser optimizations may improve Workers compatibility
- **Risk:** Fork maintenance uncertainty

#### **markdown2pdfmake**

- **Purpose:** Alternative Markdown to pdfmake converter
- **Status:** Identified but details unavailable from research
- **Expected Functionality:** MD → pdfmake format
- **Likely Similar:** To mdpdfmake variants

#### **marked**

- **Repository:** markedjs/marked
- **Purpose:** Markdown parser (MD → HTML)
- **How It Works:**
  ```javascript
  import { marked } from 'marked'
  const html = marked.parse('# Title\n**Bold**')
  // Returns: <h1>Title</h1><p><strong>Bold</strong></p>
  ```
- **Input:** Markdown string
- **Output:** HTML string
- **Bundle Size:** 14KB gzipped
- **npm Statistics:** ~16M weekly downloads, 33k GitHub stars
- **Maintenance:** Industry standard, actively maintained
- **Features:**
  - Full CommonMark support
  - GFM (GitHub Flavored Markdown)
  - Extensible via plugins
  - Async rendering
  - Syntax highlighting hooks
- **Cloudflare Workers Compatibility:** ✅ **Confirmed** - Pure JavaScript, no dependencies
- **Quality:** N/A (parser only, doesn't generate PDF)
- **Incentive Alignment:**
  - Cost: ✅ Minimal overhead
  - Quality: N/A
  - Pre-written: ✅ But only solves parsing step
- **Use Case:** Component in larger solution (would need HTML→PDF step)
- **Gap:** Requires pairing with PDF generation library (violates incentive #3)

---

### Python Ecosystem

#### **fpdf2**

- **Repository:** py-pdf/fpdf2
- **Purpose:** Pure Python PDF generation with HTML rendering
- **How It Works:**
  ```python
  from fpdf import FPDF
  pdf = FPDF()
  pdf.add_page()
  # Option 1: Manual
  pdf.set_font('Arial', 'B', 16)
  pdf.cell(40, 10, 'Title')
  # Option 2: HTML (KEY FEATURE)
  pdf.write_html('<h1>Title</h1><p><b>Bold</b></p>')
  pdf.output('document.pdf')
  ```
- **Input:** HTML string (via `write_html()`)
- **Output:** Binary PDF
- **Bundle Size:** ~200KB
- **PyPI Statistics:** Actively maintained fork of original FPDF
- **Maintenance:** Active development
- **Features:**
  - HTML rendering via `write_html()`
  - Supports HTML subset (h1-h6, p, b, i, u, br, hr, a, img, table)
  - CSS styling (limited subset)
  - Custom fonts (TrueType)
  - Images (JPEG, PNG)
  - Tables
  - Auto page breaks
  - Headers/footers
- **Pyodide Compatibility:**
  - **Likely Yes** - Pure Python, no C extensions
  - Would need verification
- **Cloudflare Workers Compatibility:**
  - Python Workers are beta
  - fpdf2 pure Python should work
  - **Needs testing**
- **Quality:** ✅ Good - `write_html()` handles layout automatically
- **Incentive Alignment:**
  - Cost: ✅ ~$0.00001/PDF (Python Worker CPU time)
  - Quality: ✅ Good HTML rendering with CSS
  - Pre-written: ✅ **`write_html()` eliminates manual positioning**
- **Complete Workflow:**

  ```python
  import markdown
  from fpdf import FPDF

  md_text = "# Title\n**Bold**"
  html = markdown.markdown(md_text)

  pdf = FPDF()
  pdf.add_page()
  pdf.write_html(html)
  return pdf.output(dest='S')
  ```

- **Code Complexity:** ~10 lines of glue code
- **Risk:** Beta Python Workers, unverified Pyodide compatibility

#### **markdown (python-markdown)**

- **Repository:** Python-Markdown/markdown
- **Purpose:** Markdown parser (MD → HTML)
- **How It Works:**
  ```python
  import markdown
  html = markdown.markdown('# Title\n**Bold**')
  ```
- **Input:** Markdown string
- **Output:** HTML5 string
- **Bundle Size:** ~100KB
- **PyPI Statistics:** Standard Python Markdown library
- **Maintenance:** Active, official Python package
- **Features:**
  - Full CommonMark support
  - Extensions (tables, code highlighting, etc.)
  - Custom processors
- **Pyodide Compatibility:** ✅ Yes - pure Python
- **Quality:** Only parses, doesn't generate PDF
- **Use Case:** Pairs with fpdf2 for complete solution

#### **markdown2**

- **Repository:** trentm/python-markdown2
- **Purpose:** Alternative Python Markdown parser
- **How It Works:** Similar to python-markdown
- **Bundle Size:** ~80KB
- **PyPI Statistics:** Popular alternative
- **Features:**
  - Faster than python-markdown
  - Different extras/extensions
  - More permissive parsing
- **Pyodide Compatibility:** ✅ Yes - pure Python
- **Distinction:** Performance-focused alternative

#### **mistune**

- **Repository:** lepture/mistune
- **Purpose:** Fastest Python Markdown parser
- **Bundle Size:** ~50KB
- **Features:** Pure Python, optimized for speed
- **Pyodide Compatibility:** ✅ Yes
- **Advantage:** Best performance for high-volume use

---

### Rust Ecosystem

#### **pulldown-cmark**

- **Repository:** pulldown-cmark/pulldown-cmark
- **Purpose:** Fast CommonMark Markdown parser
- **How It Works:** Event-based parsing (yields events like Start/End tags)
- **Bundle Size:** ~300KB when compiled to WASM
- **crates.io Statistics:** ~13M downloads, industry standard
- **WASM Compatibility:** ✅ Yes - explicitly designed for WASM targets
- **Cloudflare Workers Compatibility:** ✅ Yes for parsing
- **Quality:** Only parses, no PDF generation
- **Use Case:** Could parse MD in Rust Worker, send to Python Worker for PDF
- **Incentive Alignment:**
  - Cost: ✅ Efficient
  - Quality: N/A (parser only)
  - Pre-written: ⚠️ Would need pipeline to PDF generator
- **Gap:** No PDF generation capability

#### **printpdf**

- **Repository:** fschutt/printpdf
- **Purpose:** Low-level PDF generation in Rust
- **How It Works:** Manual placement of text, shapes, images
- **WASM Compatibility:** Unknown - uses `std::fs` which may not work in WASM
- **Quality:** Low-level - requires manual positioning of every element
- **Incentive Alignment:**
  - Cost: ✅ Efficient
  - Quality: ⚠️ Manual positioning required
  - Pre-written: ❌ **Requires extensive custom layout logic**
- **Fatal Flaw:** No HTML rendering, defeats incentive #3

#### **genpdf**

- **Repository:** genpdf-rs/genpdf
- **Purpose:** Higher-level PDF generation
- **How It Works:** Document model with automatic layout
- **Features:** Auto line wrapping, page breaks
- **WASM Compatibility:** Unknown
- **Quality:** Better than printpdf but still manual document construction
- **Incentive Alignment:**
  - Cost: ✅ Efficient
  - Quality: ⚠️ Still requires manual structure
  - Pre-written: ❌ **No Markdown input support**
- **Issue:** Would need to write Markdown → genpdf conversion logic

#### **lopdf**

- **Repository:** J-F-Liu/lopdf
- **Purpose:** Low-level PDF primitives
- **How It Works:** Direct PDF object manipulation
- **WASM Compatibility:** Unknown
- **Quality:** Lowest level, most manual
- **Incentive Alignment:** ❌ Completely violates incentive #3
- **Use Case:** Building PDF libraries, not end-user PDF generation

---

## Solution Analysis

### Solutions Meeting All Three Incentives

Only **TWO** solutions identified meet all three incentives:

#### **Solution A: mdpdfmake + pdfmake (JavaScript)**

**Architecture:**

```
User Input (Markdown)
    ↓
mdpdfmake (MD → pdfmake definition)
    ↓
pdfmake (definition → PDF binary)
    ↓
Download
```

**Code Example:**

```javascript
import pdfMake from 'pdfmake'
import { markdownToPdfmake } from 'mdpdfmake'

export default {
  async fetch(request) {
    const { markdown } = await request.json()

    // One function call - no custom logic
    const docDef = markdownToPdfmake(markdown)
    const pdf = pdfMake.createPdf(docDef)

    return new Response(pdfBuffer, {
      headers: { 'Content-Type': 'application/pdf' },
    })
  },
}
```

**Incentive Assessment:**

- **Cost:** ✅ ~$0.00001/PDF (only CPU time, no external API)
- **Quality:** ✅ Professional output via pdfmake (tables, styling, fonts, layouts)
- **Pre-written:** ✅ **Zero custom logic** - complete MD→PDF in two function calls

**Bundle Size:** ~1MB (983KB pdfmake + 50KB mdpdfmake)

**Risks:**

1. **Bundle size** - Approaches Workers 10MB limit
2. **Node.js APIs** - pdfmake may use unsupported APIs despite `nodejs_compat`
3. **Low adoption** - mdpdfmake has minimal production usage (8 stars)
4. **Untested** - No documented Workers deployments

**Variant:** `@propra/mdpdfmake` (browser-focused fork, may have better Workers compatibility)

**Critical Unknown:** Whether pdfmake works in Workers at all

---

#### **Solution B: markdown + fpdf2 (Python Worker)**

**Architecture:**

```
User Input (Markdown)
    ↓
Python Worker
    ├─ markdown.markdown(md) → HTML
    └─ fpdf.write_html(html) → PDF
    ↓
Download
```

**Code Example:**

```python
from js import Response, Headers
import markdown
from fpdf import FPDF

async def on_fetch(request):
    data = await request.json()
    md_text = data['markdown']

    # Step 1: Parse Markdown to HTML (one line)
    html = markdown.markdown(md_text)

    # Step 2: Render HTML to PDF (three lines)
    pdf = FPDF()
    pdf.add_page()
    pdf.write_html(html)

    # Return PDF
    pdf_bytes = pdf.output(dest='S').encode('latin-1')
    return Response.new(pdf_bytes, headers=Headers.new({
        'Content-Type': 'application/pdf'
    }))
```

**Incentive Assessment:**

- **Cost:** ✅ ~$0.00001/PDF (Python Worker CPU time, no external API)
- **Quality:** ✅ Good - `write_html()` handles HTML/CSS rendering automatically
- **Pre-written:** ✅ **Minimal glue code** - `write_html()` does the heavy lifting

**Bundle Size:** ~300KB (200KB fpdf2 + 100KB markdown)

**Risks:**

1. **Python Workers Beta** - Platform stability concerns
2. **Pyodide Compatibility** - fpdf2 not verified to work in Pyodide
3. **HTML/CSS Subset** - fpdf2 supports limited HTML tags and CSS properties
4. **Quality Uncertainty** - fpdf2's rendering quality vs pdfmake unknown

**Advantages:**

- Smaller bundle size than pdfmake
- Python workers isolated from frontend bundle
- `write_html()` eliminates manual positioning

**Critical Unknowns:**

- fpdf2 Pyodide compatibility
- HTML rendering quality for complex Markdown

---

### Solutions Failing Incentive Requirements

#### **Marked + pdf-lib (JavaScript) - FAILS**

- **Why:** Requires extensive custom layout logic
- **Code Required:** 200-300 lines of manual positioning, wrapping, page breaks
- **Violates:** Incentive #3 (use pre-written logic)

#### **Marked + jsPDF (JavaScript) - FAILS**

- **Why:** jsPDF has no HTML rendering; requires manual PDF construction
- **Code Required:** 200-300 lines
- **Violates:** Incentive #3

#### **Rust Crates (Any) - FAILS**

- **Why:** No Rust libraries combine MD parsing + PDF generation with HTML rendering
- **Code Required:** Would need to write full layout engine
- **Violates:** Incentive #3

#### **Cloudflare Browser Rendering - FAILS**

- **Why:** $0.0007 per PDF vs $0.00001 for other solutions
- **Cost:** $70 per 100k PDFs vs $1
- **Violates:** Incentive #1 (minimize cost)
- **Note:** Perfect quality (✅ incentive #2) and zero custom logic (✅ incentive #3)

---

## Multi-Worker Pipeline Options

### Option: Rust Parser → Python PDF Generator

**Architecture:**

```
Frontend (Astro)
    ↓
Rust Worker (pulldown-cmark)
    - Parse Markdown → HTML
    ↓
Python Worker (fpdf2)
    - write_html() → PDF
    ↓
Download
```

**Incentive Assessment:**

- **Cost:** ✅ ~$0.00001/PDF (two Workers, minimal overhead)
- **Quality:** ✅ fpdf2 quality
- **Pre-written:** ⚠️ **Moderate** - need to connect two systems

**Advantages:**

- Rust parsing performance
- Python PDF generation with `write_html()`
- Bundle isolation

**Disadvantages:**

- Architectural complexity (two Workers)
- Two points of failure
- Inter-worker latency (minimal but present)
- More deployment complexity

**Assessment:** **More complex than single-worker solutions without clear benefit** - Rust parsing not significantly faster than Python's mistune for typical documents

---

## Strategic Conclusions

### Critical Findings

1. **Only TWO viable solutions exist** that meet all three incentives:

   - mdpdfmake + pdfmake (JavaScript)
   - markdown + fpdf2 (Python Worker)

2. **Both solutions have uncertainties** requiring validation:

   - pdfmake Workers compatibility unknown
   - fpdf2 Pyodide compatibility unknown

3. **All other approaches violate incentive #3** by requiring custom layout logic

4. **Browser Rendering violates incentive #1** but guarantees incentives #2 and #3

### The Validation Requirement

**Cannot eliminate either candidate without testing** because:

- Web search cannot verify Workers/Pyodide compatibility
- Both are theoretically sound
- Both have reasonable bundle sizes
- Both provide complete solutions

### Decision Framework

**If mdpdfmake + pdfmake works:**

- ✅ Best solution (JavaScript-native, mature library)
- ✅ Professional output quality
- ⚠️ Large bundle size (manageable)

**If markdown + fpdf2 works:**

- ✅ Good solution (smaller bundle, Python ecosystem)
- ✅ Good output quality
- ⚠️ Python Workers beta status

**If both fail:**

- Must choose between:
  - Writing custom logic (violates incentive #3)
  - Using Browser Rendering (violates incentive #1)

### Recommended Validation Order

1. **Test mdpdfmake + pdfmake first**

   - Reason: JavaScript-native, no language mixing
   - If works: Ship immediately

2. **Test markdown + fpdf2 second**

   - Reason: Python Workers beta, more risk
   - If works: Alternative solution

3. **If both fail: Reassess incentives**
   - Browser Rendering guarantees incentives #2 and #3
   - Custom logic solutions compromise incentive #3
   - Must choose which incentive to compromise

---

## Technical Implementation Notes

### For mdpdfmake + pdfmake Testing

**Worker Setup:**

```toml
# wrangler.toml
compatibility_flags = ["nodejs_compat"]
```

**Dependencies:**

```json
{
  "dependencies": {
    "pdfmake": "^0.2.x",
    "mdpdfmake": "latest"
  }
}
```

**Success Criteria:**

- Deploys without bundle size error
- Generates PDF without runtime errors
- PDF output has correct formatting

### For markdown + fpdf2 Testing

**Worker Type:** Python Worker

**Dependencies:**

```python
# requirements.txt
fpdf2
markdown
```

**Success Criteria:**

- Pyodide loads fpdf2 successfully
- HTML rendering produces correct layout
- PDF quality acceptable

---

## Cost Analysis

### Per-PDF Cost Breakdown

**JavaScript/Python Workers:**

- CPU time: ~$0.02 per 1M CPU-ms
- Typical PDF generation: ~10-50ms
- Cost: ~$0.00001/PDF

**Browser Rendering:**

- Cost: $0.09/browser-hour
- Typical PDF: 2-3 seconds
- Cost: ~$0.0007/PDF

**Comparison:**

- 100,000 PDFs/month:
  - Workers: $1
  - Browser: $70
  - **Difference: $69/month**

---

## Open Questions

1. **pdfmake Workers Compatibility**

   - Does pdfmake work with `nodejs_compat`?
   - Does bundle size fit within limits after tree-shaking?

2. **fpdf2 Pyodide Compatibility**

   - Is fpdf2 available in Pyodide packages?
   - Do all fpdf2 features work in Pyodide environment?

3. **Output Quality Comparison**

   - How does fpdf2 HTML rendering compare to pdfmake?
   - Are there Markdown edge cases where one fails?

4. **Performance Characteristics**
   - JavaScript vs Python Worker performance for typical documents
   - Memory usage for large Markdown files

---

## Next Steps

Implementation plan requires testing both viable solutions to validate assumptions and measure actual quality/performance.
