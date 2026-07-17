import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/nano-explorer/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dlvo:      resolve(__dirname, 'src/applets/dlvo/index.html'),
        derjaguin: resolve(__dirname, 'src/applets/derjaguin/index.html'),
        crystallography: resolve(__dirname, 'src/applets/crystallography/index.html'),
        'mo-diagrams': resolve(__dirname, 'src/applets/mo-diagrams/index.html'),
      },
    },
  },
})
