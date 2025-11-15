# Markdown to PDF Converter

A client-side Markdown to PDF converter built with Astro and pdfmake. Convert your Markdown documents to professional PDFs instantly in your browser - no backend required!

## ✨ Features

- 🚀 **Client-side processing** - Everything happens in your browser
- 🔒 **Private** - Your documents never leave your device
- ⚡ **Fast** - Instant preview and quick PDF generation
- 💎 **High quality** - Real PDFs with selectable, searchable text
- 📱 **Responsive** - Works on desktop and mobile
- 🎨 **Beautiful UI** - Modern dark theme with smooth animations
- ⌨️ **Keyboard shortcuts** - Ctrl/Cmd + Enter to preview

## 🛠️ Tech Stack

- **Astro** - Static site generator
- **marked** - Markdown parser (16M downloads/week)
- **html-to-pdfmake** - HTML to PDF converter
- **pdfmake** - PDF generation engine
- **Bun** - Fast JavaScript runtime
- **Cloudflare Pages** - Hosting

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

1. **Type or paste** your Markdown in the left editor
2. Click **"Preview"** to see the HTML rendering
3. Click **"Download PDF"** to generate and download your PDF
4. Use **Ctrl/Cmd + Enter** as a keyboard shortcut to preview

### Supported Markdown Features

- ✅ Headers (h1-h6)
- ✅ Bold, italic, strikethrough
- ✅ Links
- ✅ Images
- ✅ Inline code and code blocks
- ✅ Lists (ordered and unordered)
- ✅ Tables
- ✅ Blockquotes
- ✅ Horizontal rules

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
├── docs/
│   └── IMPLEMENTATION.md            # Full implementation guide
├── astro.config.mjs                 # Astro configuration
├── package.json
└── README.md
```

## 🔧 Configuration

### PDF Customization

You can customize PDF output by modifying the `docDefinition` in `src/components/MarkdownConverter.astro`:

```javascript
const docDefinition = {
  content: pdfContent,
  defaultStyle: {
    fontSize: 11,        // Change font size
    font: 'Roboto'       // Change font family
  },
  pageMargins: [50, 50, 50, 50]  // Adjust margins [left, top, right, bottom]
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🙏 Acknowledgments

- [Astro](https://astro.build) - Static site generator
- [marked](https://marked.js.org) - Markdown parser
- [pdfmake](https://pdfmake.github.io/) - PDF generation
- [html-to-pdfmake](https://github.com/Aymkdn/html-to-pdfmake) - HTML converter

## 📚 Documentation

For detailed implementation guide, see [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)

---

**Built with ❤️ using Astro, pdfmake, and Bun**
