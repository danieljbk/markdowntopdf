// @ts-check
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://markdown.kwon.ai',
  output: 'static', // Static site generation
  build: {
    format: 'file', // Generate index.html files
  },
})
