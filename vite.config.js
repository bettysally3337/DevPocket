import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function copyFfmpegCore() {
  return {
    name: 'copy-ffmpeg-core',
    closeBundle() {
      const target = resolve('dist/ffmpeg')
      const source = resolve('node_modules/@ffmpeg/core/dist/umd')
      mkdirSync(target, { recursive: true })
      copyFileSync(resolve(source, 'ffmpeg-core.js'), resolve(target, 'ffmpeg-core.js'))
      copyFileSync(resolve(source, 'ffmpeg-core.wasm'), resolve(target, 'ffmpeg-core.wasm'))
    }
  }
}

export default defineConfig({ base: '/DevPocket/', plugins: [vue(), copyFfmpegCore()] })
