# Quick Start Guide 🚀

Get your Markdown to PDF converter running in 60 seconds!

## Step 1: Start Development Server

```bash
bun run dev
```

## Step 2: Open in Browser

Visit: **http://localhost:4321**

## Step 3: Test It Out!

1. **Type some Markdown** in the left editor (or use the sample content)
2. Click **"Preview"** button to see HTML rendering
3. Click **"Download PDF"** button to generate your PDF
4. Check your downloads folder for `markdown-YYYY-MM-DD.pdf`

## Keyboard Shortcuts

- **Ctrl/Cmd + Enter** - Preview Markdown

## Sample Markdown to Try

```markdown
# My First PDF

This is a **bold** statement and this is *italic*.

## Features I Love

- Easy to use
- Beautiful output
- No backend needed!

### Try a Table

| Feature | Status |
|---------|--------|
| Preview | ✅ Working |
| PDF | ✅ Working |
| Privacy | ✅ Perfect |

> "This is amazing!" - You, probably

## Code Example

\`\`\`javascript
function hello() {
  console.log('Hello from PDF!');
}
\`\`\`
```

## Next Steps

### Deploy to Production

```bash
# Build for production
bun run build

# Deploy to Cloudflare Pages
bun add -g wrangler
wrangler login
wrangler pages deploy dist --project-name=md2pdf
```

### Customize

Edit `src/components/MarkdownConverter.astro` to:
- Change colors (CSS variables in `src/layouts/Layout.astro`)
- Adjust PDF styles (modify `docDefinition` styles)
- Add custom fonts
- Modify page margins

## Troubleshooting

### PDF Not Downloading?
- Check browser console (F12) for errors
- Ensure pdfmake fonts loaded: Open console, type `pdfMake.vfs`

### Preview Not Updating?
- Check if Markdown is valid
- Try refreshing the page

### Build Errors?
- Run `bun install` to ensure dependencies are installed
- Check Node/Bun version (need Bun v1.0+)

## That's It!

You now have a fully functional Markdown to PDF converter running locally. 

**Enjoy! 🎉**

For more details, see:
- `README.md` - Full documentation
- `docs/IMPLEMENTATION.md` - Implementation guide
- `IMPLEMENTATION-STATUS.md` - What's been built

