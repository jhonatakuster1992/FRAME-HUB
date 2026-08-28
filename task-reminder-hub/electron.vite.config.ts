import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * O CSP das paginas e estrito ('script-src self'), mas o Fast Refresh do
 * plugin-react injeta um preamble inline. So no dev server, afrouxa o
 * suficiente para o HMR rodar — o build de producao continua estrito.
 */
function devCspPlugin(): Plugin {
  return {
    name: 'dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), devCspPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          // cada superficie e um documento HTML no mesmo bundle
          dashboard: resolve(__dirname, 'src/renderer/dashboard.html'),
          postit: resolve(__dirname, 'src/renderer/postit.html'),
          capture: resolve(__dirname, 'src/renderer/capture.html'),
          alerta: resolve(__dirname, 'src/renderer/alerta.html')
        }
      }
    }
  }
})
