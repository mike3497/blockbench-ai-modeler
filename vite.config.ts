/// <reference types="vitest/config" />
import {defineConfig} from 'vite';

export default defineConfig({
	build: {
		lib: {
			entry: 'src/ai_modeler.ts',
			name: 'AIModelerPlugin',
			formats: ['iife'],
			fileName: () => 'ai_modeler.js'
		},
		minify: false,
		outDir: 'dist'
	},
	test: {include: ['src/**/*.test.ts']}
});
