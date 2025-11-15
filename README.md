# Markdown to PDF Converter

A client-side, GitHub-style Markdown rendering experience that relies on your browser’s built-in **Print → Save as PDF** dialog. No backend, no headless browser, and no pdfmake glue code.

## ✨ Features

- 🚀 **Client-side processing** – Everything happens in your browser
- 🔒 **Private** – Your documents never leave your device
- ⚡ **Fast** – Instant preview, instant print dialog
- 💎 **High quality** – Print dialog produces selectable, searchable PDFs
- 📱 **Responsive** – Works on desktop and mobile
- 🎨 **Beautiful UI** – GitHub-style Markdown rendered in a dark shell
- 🧮 **KaTeX math** – Inline and block LaTeX render identically in preview and print
- ⌨️ **Keyboard shortcuts** – Ctrl/Cmd + Enter to preview

## 🛠️ Tech Stack

- **Astro** – Static site generator
- **marked** – Markdown parser with GitHub-flavored Markdown support
- **KaTeX** – Client-side LaTeX rendering
- **github-markdown-css** – GitHub’s Markdown typography/spacing
- **Bun** – Package manager/runtime
- **Cloudflare Pages** – Hosting

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd md2pdf

# Install dependencies
bun install

# Start development server
bun run dev
```

The site will be available at `http://localhost:4321`

### Build for Production

```bash
# Build static files
bun run build

# Preview production build
bun run preview
```

## 📦 Deployment

### Deploy to Cloudflare Pages

#### Option 1: Wrangler CLI

```bash
# Install Wrangler
bun add -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=md2pdf
```

#### Option 2: GitHub Integration

1. Push your code to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
3. Click "Create a project" → "Connect to Git"
4. Select your repository
5. Configure build settings:
   - Build command: `bun run build`
   - Build output directory: `dist`
   - Framework preset: Astro
   - Environment variables: `BUN_VERSION` = `1.0.0`
6. Click "Save and Deploy"

## 📖 Usage

1. **Type or paste** your Markdown in the editor (Ctrl/Cmd + Enter also triggers preview).
2. Click **“Preview”** to re-render the GitHub-style HTML.
3. Click **“Print / Save as PDF.”** When your browser’s print dialog opens, choose **Save as PDF** (Chrome/Edge/Firefox) or use the system PDF option (Safari/macOS).

### Supported Markdown Features

- ✅ Headers (h1-h6)
- ✅ Bold, italic, strikethrough
- ✅ Links
- ✅ Images (anything the browser can load over HTTP/S)
- ✅ Inline code and code blocks
- ✅ Lists (ordered and unordered)
- ✅ Tables
- ✅ Blockquotes
- ✅ Horizontal rules

### Known Limitations

- Printing relies on your browser’s dialog. Chrome/Edge/Firefox expose “Save as PDF” directly; Safari uses macOS’s PDF buttons.
- Remote assets must load in the browser (CORS rules apply). If an image/font can’t load, it will not appear in the PDF either.
- No server rendering. Extremely large Markdown files may be constrained by browser memory.

## 💰 Cost

**Total operational cost: $0/month**

- No backend required
- No API calls
- Client-side processing scales infinitely
- Free Cloudflare Pages hosting (unlimited bandwidth)

## 🎯 Project Structure

```
md2pdf/
├── src/
│   ├── components/
│   │   └── MarkdownConverter.astro  # Main converter component
│   ├── layouts/
│   │   └── Layout.astro             # Base layout
│   └── pages/
│       └── index.astro              # Home page
├── public/
│   └── favicon.svg
├── astro.config.mjs                 # Astro configuration
├── package.json
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🙏 Acknowledgments

- [Astro](https://astro.build) – Static site generator
- [marked](https://marked.js.org) – Markdown parser
- [KaTeX](https://katex.org/) – LaTeX rendering
- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) – GitHub’s Markdown styles

---

**Built with ❤️ using Astro, KaTeX, marked, and Bun**
