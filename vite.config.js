import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/nano-explorer/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dlvo: resolve(__dirname, 'src/applets/dlvo/index.html'),
      },
    },
  },
})
