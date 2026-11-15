import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin'

export default defineConfig({ plugins: [react(), glideSourceStamping()] })
