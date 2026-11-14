# AI Modeler for Blockbench

A Blockbench Desktop plugin that creates editable cube models from a text prompt, optional style instructions, and front, left, right, or back reference photos (one photo per view, up to 10 MB each).

## Build and install

1. Install Node.js, then run `npm install` in this repository.
2. Run `npm run build`; this type-checks the TypeScript and creates `dist/ai_modeler.js` with Vite.
3. In Blockbench Desktop, open **File → Plugins…** and load the built file, or drag it into Blockbench.
4. Add your OpenAI API key under **File → Preferences → Settings** in the General category.
5. Open **Tools → AI Modeler**.

Run `npm test` to execute the Vitest suite.

Plugin source lives in `src/ai_modeler.ts`. The TypeScript build emits a standalone JavaScript plugin; Blockbench does not load the TypeScript source directly.

Each user supplies their own OpenAI API key. The plugin sends the key, prompt, and selected reference photos directly to OpenAI's Responses API. API usage may incur charges. The key is saved in Blockbench settings, and local plugins can access it; use a dedicated key and only install plugin code you trust.

Style presets are saved in local Blockbench storage and can be reused across prompts. Reference photos are held for the current generation only. V1 creates cube geometry in the open project; texture painting and animation generation are not included. The disabled **Animations · v2** tab reserves a place for future animation controls.

This generative-AI plugin is shared for manual installation because the official Blockbench plugin repository does not accept generative-AI plugins.
