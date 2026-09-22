import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// viteSingleFile: JS/CSS를 index.html 하나에 인라인 → Electron(exe)에서 loadFile로 열어도
//   CSS/JS가 정상 적용됨. (외부 자산 로딩 문제 회피)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    viteSingleFile(),
    tailwindcss(), // 2. 플러그인 추가
  ],
})