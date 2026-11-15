(function() {
	// src/model.ts
	function isRecord(value) {
		return typeof value === "object" && value !== null;
	}
	function isVector(value, maxAbs = 64) {
		return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= maxAbs);
	}
	function validateModel(value) {
		if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) throw new Error("The model response needs a name.");
		if (!Array.isArray(value.elements) || value.elements.length < 1 || value.elements.length > 200) throw new Error("The model must contain between 1 and 200 cubes. Try a simpler prompt.");
		const elements = value.elements.map((element) => {
			if (!isRecord(element) || typeof element.name !== "string" || !isVector(element.from) || !isVector(element.to) || !isVector(element.rotation, 180) || !isVector(element.origin)) throw new Error("The model response contains invalid cube data.");
			const from = element.from;
			const to = element.to;
			const rotation = element.rotation;
			const origin = element.origin;
			if (from.some((coordinate, index) => coordinate >= to[index])) throw new Error("The model response contains a cube with zero or negative size.");
			return {
				name: element.name.trim().slice(0, 64) || "Cube",
				from,
				to,
				rotation,
				origin
			};
		});
		return {
			name: value.name.trim().slice(0, 64),
			elements
		};
	}
	// src/api_key_paste.ts
	function isApiKeyPasteShortcut(event, targetIsApiKeyInput) {
		return targetIsApiKeyInput && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";
	}
	// src/ai_modeler.ts
	var AI_MODELER_MODELS = [
		{
			id: "gpt-6.1-terra",
			name: "GPT-6.1 Terra"
		},
		{
			id: "gpt-6-luna",
			name: "GPT-6 Luna"
		},
		{
			id: "gpt-6.1-sol",
			name: "GPT-6.1 Sol"
		},
		{
			id: "gpt-6-astra",
			name: "GPT-6 Astra"
		}
	];
	var AI_MODELER_VIEWS = [
		"front",
		"left",
		"right",
		"back"
	];
	var AI_MODELER_PRESETS_KEY = "ai_modeler_style_presets_v1";
	var AI_MODELER_IMAGE_TYPES = [
		"image/png",
		"image/jpeg",
		"image/webp"
	];
	var AI_MODELER_SCHEMA = {
		type: "object",
		properties: {
			name: { type: "string" },
			elements: {
				type: "array",
				items: {
					type: "object",
					properties: {
						name: { type: "string" },
						from: {
							type: "array",
							items: { type: "number" }
						},
						to: {
							type: "array",
							items: { type: "number" }
						},
						rotation: {
							type: "array",
							items: { type: "number" }
						},
						origin: {
							type: "array",
							items: { type: "number" }
						}
					},
					required: [
						"name",
						"from",
						"to",
						"rotation",
						"origin"
					],
					additionalProperties: false
				}
			}
		},
		required: ["name", "elements"],
		additionalProperties: false
	};
	var aiModelerAction;
	var aiModelerApiKeySetting;
	function aiModelerHandleApiKeyPaste(event) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) || target.type !== "password") return;
		if (isApiKeyPasteShortcut(event, Boolean(target.closest("#setting_ai_modeler_openai_api_key")))) event.stopImmediatePropagation();
	}
	function aiModelerEscapeHTML(value) {
		const escape = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		};
		return String(value).replace(/[&<>"']/g, (char) => escape[char]);
	}
	function aiModelerIsRecord(value) {
		return typeof value === "object" && value !== null;
	}
	function aiModelerLoadPresets() {
		try {
			const presets = JSON.parse(localStorage.getItem(AI_MODELER_PRESETS_KEY) || "[]");
			return Array.isArray(presets) ? presets.filter((item) => aiModelerIsRecord(item) && typeof item.name === "string" && typeof item.instructions === "string") : [];
		} catch {
			return [];
		}
	}
	function aiModelerSavePresets(presets) {
		localStorage.setItem(AI_MODELER_PRESETS_KEY, JSON.stringify(presets));
	}
	function aiModelerPresetOptions(presets) {
		return "<option value=\"\">No saved style</option>" + presets.map((preset) => `<option value="${aiModelerEscapeHTML(preset.name)}">${aiModelerEscapeHTML(preset.name)}</option>`).join("");
	}
	function aiModelerDialogHTML(presets) {
		const modelOptions = AI_MODELER_MODELS.map((model) => `<option value="${model.id}"${model.id === "gpt-6.1-terra" ? " selected" : ""}>${model.name}</option>`).join("");
		const viewSlots = AI_MODELER_VIEWS.map((view) => `
		<div class="ai-view-slot" data-view-slot="${view}">
			<div class="ai-view-heading">
				<strong>${view[0].toUpperCase() + view.slice(1)} view</strong>
				<button type="button" class="ai-small-button" data-action="choose-image" data-view="${view}">Choose photo</button>
				<input type="file" accept="image/png,image/jpeg,image/webp" data-image-input="${view}" hidden>
			</div>
			<div class="ai-view-preview">
				<span class="ai-view-empty">No reference photo</span>
				<img alt="${view} view reference preview" hidden>
			</div>
			<div class="ai-view-file-row">
				<span class="ai-view-file-name"></span>
				<button type="button" class="ai-text-button" data-action="remove-image" data-view="${view}" hidden>Remove</button>
			</div>
		</div>`).join("");
		return `
	<style>
		.ai-modeler-root { color: var(--color-text, inherit); font: inherit; width: 100%; }
		.ai-modeler-root * { box-sizing: border-box; }
		.ai-modeler-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border, #555); margin: 0 0 16px; }
		.ai-modeler-tab { border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--color-text, inherit); padding: 8px 12px; font: inherit; }
		.ai-modeler-tab[aria-selected="true"] { border-bottom-color: var(--color-accent, #58a6ff); }
		.ai-modeler-tab:disabled { opacity: .5; }
		.ai-modeler-field { display: block; min-width: 0; }
		.ai-modeler-label { display: block; margin-bottom: 6px; font-weight: 600; }
		.ai-modeler-input, .ai-modeler-select { width: 100%; min-height: 32px; padding: 6px 8px; color: var(--color-text, inherit); background: var(--color-back, #252526); border: 1px solid var(--color-border, #555); border-radius: 3px; font: inherit; }
		.ai-modeler-input:focus-visible, .ai-modeler-select:focus-visible, .ai-modeler-root button:focus-visible { outline: 2px solid var(--color-accent, #58a6ff); outline-offset: 1px; }
		.ai-modeler-input { resize: vertical; }
		.ai-modeler-prompt { min-height: 72px; }
		.ai-modeler-style { min-height: 56px; }
		.ai-modeler-controls { display: grid; grid-template-columns: minmax(150px, .8fr) minmax(0, 1.2fr); gap: 12px; margin: 14px 0; }
		.ai-modeler-preset-row { display: flex; gap: 6px; }
		.ai-modeler-preset-row select { flex: 1; min-width: 0; }
		.ai-small-button, .ai-text-button { color: var(--color-text, inherit); background: var(--color-ui, #393939); border: 1px solid var(--color-border, #555); border-radius: 3px; padding: 6px 9px; font: inherit; cursor: pointer; }
		.ai-text-button { background: transparent; border-color: transparent; padding: 2px 4px; }
		.ai-modeler-help, .ai-modeler-privacy { color: var(--color-text-light, #aaa); font-size: .9em; margin: 5px 0 0; }
		.ai-modeler-ref-heading { margin: 16px 0 8px; }
		.ai-modeler-ref-heading p { color: var(--color-text-light, #aaa); font-size: .9em; margin: 4px 0 0; }
		.ai-modeler-views { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
		.ai-view-slot { min-width: 0; padding: 8px; border: 1px solid var(--color-border, #555); border-radius: 3px; background: var(--color-ui, #303030); }
		.ai-view-heading, .ai-view-file-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-width: 0; }
		.ai-view-heading strong { font-weight: 600; }
		.ai-view-preview { display: grid; place-items: center; height: 96px; margin-top: 7px; overflow: hidden; border: 1px dashed var(--color-border, #555); background: var(--color-back, #252526); color: var(--color-text-light, #aaa); }
		.ai-view-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }
		.ai-view-file-row { min-height: 22px; margin-top: 3px; }
		.ai-view-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-light, #aaa); font-size: .85em; }
		.ai-modeler-privacy { margin-top: 12px; }
		.ai-modeler-status { min-height: 20px; margin-top: 8px; color: var(--color-text-light, #aaa); }
		.ai-modeler-status[data-error="true"] { color: var(--color-error, #e66); }
		@media (max-width: 620px) { .ai-modeler-controls { grid-template-columns: 1fr; } }
	</style>
	<div class="ai-modeler-root">
		<div class="ai-modeler-tabs" role="tablist" aria-label="AI model workflow">
			<button type="button" class="ai-modeler-tab" role="tab" aria-selected="true">Model</button>
			<button type="button" class="ai-modeler-tab" role="tab" disabled title="Animation tools are planned for v2">Animations · v2</button>
		</div>
		<label class="ai-modeler-field">
			<span class="ai-modeler-label">What do you want to model?</span>
			<textarea class="ai-modeler-input ai-modeler-prompt" data-field="prompt" placeholder="A small fox wearing a scarf…"></textarea>
		</label>
		<div class="ai-modeler-controls">
			<label class="ai-modeler-field">
				<span class="ai-modeler-label">Model</span>
				<select class="ai-modeler-select" data-field="model">${modelOptions}</select>
			</label>
			<label class="ai-modeler-field">
				<span class="ai-modeler-label">Style preset</span>
				<span class="ai-modeler-preset-row">
					<select class="ai-modeler-select" data-field="preset">${aiModelerPresetOptions(presets)}</select>
					<button type="button" class="ai-small-button" data-action="save-preset">Save style</button>
				</span>
			</label>
		</div>
		<label class="ai-modeler-field">
			<span class="ai-modeler-label">Style instructions</span>
			<textarea class="ai-modeler-input ai-modeler-style" data-field="style" placeholder="For example: chunky shapes, muted colors, hand-painted details…"></textarea>
		</label>
		<p class="ai-modeler-help">Choose a saved style to reuse it, or edit these instructions before generating.</p>
		<div class="ai-modeler-ref-heading">
			<strong>Reference views</strong>
			<p>Assign each photo to the view it shows. All four are optional; 10 MB per photo.</p>
		</div>
		<div class="ai-modeler-views">${viewSlots}</div>
		<p class="ai-modeler-privacy">Your prompt and selected photos are sent to OpenAI and may incur API charges. Your API key is kept in this Blockbench installation.</p>
		<div class="ai-modeler-status" role="status" aria-live="polite" data-field="status"></div>
	</div>`;
	}
	function aiModelerReadFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(/* @__PURE__ */ new Error(`Could not read ${file.name}.`));
			reader.onerror = () => reject(/* @__PURE__ */ new Error(`Could not read ${file.name}.`));
			reader.readAsDataURL(file);
		});
	}
	function aiModelerExtractText(response) {
		if (!aiModelerIsRecord(response) || !Array.isArray(response.output)) throw new Error("The API returned no model data. Try again with a shorter prompt.");
		for (const item of response.output || []) {
			if (!aiModelerIsRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
			for (const content of item.content || []) {
				if (!aiModelerIsRecord(content)) continue;
				if (content.type === "refusal") throw new Error(typeof content.refusal === "string" ? content.refusal : "The model declined this request.");
				if (content.type === "output_text" && typeof content.text === "string" && content.text) return content.text;
			}
		}
		throw new Error("The API returned no model data. Try again with a shorter prompt.");
	}
	function aiModelerAddToProject(model) {
		if (typeof Project === "undefined" || !Project || typeof Format === "undefined" || !Format) throw new Error("Open a Blockbench project before generating a model.");
		if (!Cube.isTypePermitted("cube")) throw new Error("The current project format does not support cube elements.");
		const group = new Group({ name: model.name });
		const cubes = model.elements.map((element) => new Cube({
			name: element.name,
			from: element.from,
			to: element.to,
			rotation: element.rotation,
			origin: element.origin,
			autouv: 1
		}));
		Undo.initEdit({
			elements: [],
			outliner: true
		});
		try {
			group.init().addTo("root");
			cubes.forEach((cube) => cube.init().addTo(group));
			Undo.finishEdit("Generate AI model");
		} catch (error) {
			cubes.forEach((cube) => {
				if (cube.parent) cube.remove();
			});
			if (group.parent) group.remove();
			if (typeof Undo.cancelEdit === "function") Undo.cancelEdit();
			else Undo.finishEdit("Generate AI model");
			throw error;
		}
		Canvas.updateView({
			elements: cubes,
			element_aspects: { geometry: true },
			selection: true
		});
		group.select();
	}
	function aiModelerSetStatus(root, message, isError = false) {
		const status = root.querySelector("[data-field=\"status\"]");
		if (!status) return;
		status.textContent = message;
		status.dataset.error = String(isError);
	}
	function aiModelerRenderReference(root, view, reference) {
		const slot = root.querySelector(`[data-view-slot="${view}"]`);
		const image = slot.querySelector("img");
		const empty = slot.querySelector(".ai-view-empty");
		const fileName = slot.querySelector(".ai-view-file-name");
		const removeButton = slot.querySelector("[data-action=\"remove-image\"]");
		image.hidden = !reference;
		empty.hidden = Boolean(reference);
		removeButton.hidden = !reference;
		fileName.textContent = reference ? reference.name : "";
		if (reference) image.src = reference.dataUrl;
		else image.removeAttribute("src");
	}
	function aiModelerSavePreset(root) {
		const styleField = root.querySelector("[data-field=\"style\"]");
		const presetSelect = root.querySelector("[data-field=\"preset\"]");
		const instructions = styleField.value.trim();
		if (!instructions) {
			aiModelerSetStatus(root, "Add style instructions before saving a preset.", true);
			return;
		}
		Blockbench.textPrompt("Save style preset", presetSelect.value, (rawName) => {
			const name = String(rawName || "").trim().slice(0, 40);
			if (!name) return;
			let presets = aiModelerLoadPresets();
			const index = presets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
			const save = () => {
				presets = aiModelerLoadPresets();
				const currentIndex = presets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
				const preset = {
					name,
					instructions
				};
				if (currentIndex >= 0) presets[currentIndex] = preset;
				else presets.push(preset);
				try {
					aiModelerSavePresets(presets);
					const select = root.querySelector("[data-field=\"preset\"]");
					select.innerHTML = aiModelerPresetOptions(presets);
					select.value = name;
					aiModelerSetStatus(root, `Saved “${name}”.`);
				} catch {
					aiModelerSetStatus(root, "Could not save the style preset in local storage.", true);
				}
			};
			if (index >= 0) Blockbench.showMessageBox({
				title: "Replace style preset?",
				message: `Replace the saved style “${aiModelerEscapeHTML(name)}”?`,
				buttons: ["Replace", "Cancel"],
				confirm: 0,
				cancel: 1
			}, (button) => {
				if (button === 0) save();
			});
			else save();
		});
	}
	async function aiModelerGenerate(dialog, root, references, state) {
		if (state.generating) return;
		const prompt = root.querySelector("[data-field=\"prompt\"]").value.trim();
		const style = root.querySelector("[data-field=\"style\"]").value.trim();
		const model = root.querySelector("[data-field=\"model\"]").value;
		const apiKey = String(aiModelerApiKeySetting.value || "").trim();
		if (!prompt) return aiModelerSetStatus(root, "Describe what you want to model first.", true);
		if (!apiKey) return aiModelerSetStatus(root, "Add your OpenAI API key in File > Preferences > Settings.", true);
		if (typeof Project === "undefined" || !Project || typeof Format === "undefined" || !Format) return aiModelerSetStatus(root, "Open a Blockbench project before generating a model.", true);
		if (!Cube.isTypePermitted("cube")) return aiModelerSetStatus(root, "The current project format does not support cube elements.", true);
		const targetProject = Project;
		const targetFormat = Format;
		const content = [{
			type: "input_text",
			text: `Create an editable Blockbench model for: ${prompt}${style ? `\n\nStyle instructions: ${style}` : ""}\n\nUse cuboids only, keep all coordinates from -64 to 64 Blockbench units, center the model near the origin, and use no more than 200 cubes. Return only the requested structured model data.`
		}];
		for (const view of AI_MODELER_VIEWS) {
			const reference = references[view];
			if (reference) {
				content.push({
					type: "input_text",
					text: `${view[0].toUpperCase() + view.slice(1)} view reference photo:`
				});
				content.push({
					type: "input_image",
					image_url: reference.dataUrl,
					detail: "high"
				});
			}
		}
		const controller = new AbortController();
		state.controller = controller;
		state.generating = true;
		root.querySelectorAll("input, textarea, select, [data-action]").forEach((element) => {
			element.disabled = true;
		});
		aiModelerSetStatus(root, "Generating model…");
		try {
			const response = await fetch("https://api.openai.com/v1/responses", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${apiKey}`
				},
				signal: controller.signal,
				body: JSON.stringify({
					model,
					store: false,
					instructions: "You create concise, editable Blockbench models using cuboids. Give each cube a useful name. Use Blockbench coordinates and valid three-number vectors. Return the model in the required JSON schema.",
					input: [{
						role: "user",
						content
					}],
					text: { format: {
						type: "json_schema",
						name: "blockbench_cube_model",
						strict: true,
						schema: AI_MODELER_SCHEMA
					} }
				})
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) {
				const apiMessage = aiModelerIsRecord(result) && aiModelerIsRecord(result.error) && typeof result.error.message === "string" ? result.error.message : `OpenAI returned HTTP ${response.status}.`;
				throw new Error(apiMessage);
			}
			const geometry = validateModel(JSON.parse(aiModelerExtractText(result)));
			if (Project !== targetProject || Format !== targetFormat) throw new Error("The active project changed during generation. Run it again in the project you want to edit.");
			aiModelerAddToProject(geometry);
			Blockbench.showToastNotification({
				text: `Generated ${geometry.name}.`,
				icon: "view_in_ar"
			});
			dialog.hide();
		} catch (error) {
			if ((aiModelerIsRecord(error) && typeof error.name === "string" ? error.name : "") !== "AbortError") aiModelerSetStatus(root, (error instanceof SyntaxError ? "The API response was not valid model JSON. Try again." : error instanceof TypeError ? "Could not reach OpenAI. Check your connection and try again." : error instanceof Error ? error.message : String(error)) || "Generation failed. Check your connection and API key.", true);
		} finally {
			state.generating = false;
			state.controller = null;
			root.querySelectorAll("input, textarea, select, [data-action]").forEach((element) => {
				element.disabled = false;
			});
		}
	}
	function aiModelerWireDialog(root, references) {
		root.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest("[data-action]");
			if (!button) return;
			const view = button.dataset.view;
			if (button.dataset.action === "choose-image") root.querySelector(`[data-image-input="${view}"]`)?.click();
			else if (button.dataset.action === "remove-image") {
				references[view] = null;
				aiModelerRenderReference(root, view, null);
			} else if (button.dataset.action === "save-preset") aiModelerSavePreset(root);
		});
		root.querySelectorAll("[data-image-input]").forEach((input) => {
			input.addEventListener("change", async () => {
				const file = input.files?.[0];
				input.value = "";
				if (!file) return;
				if (!AI_MODELER_IMAGE_TYPES.includes(file.type)) {
					aiModelerSetStatus(root, "Choose a PNG, JPEG, or WebP photo.", true);
					return;
				}
				if (file.size > 10485760) {
					aiModelerSetStatus(root, "Each reference photo must be 10 MB or smaller.", true);
					return;
				}
				const view = input.dataset.imageInput;
				try {
					references[view] = {
						name: file.name,
						dataUrl: await aiModelerReadFile(file)
					};
					aiModelerRenderReference(root, view, references[view]);
					aiModelerSetStatus(root, "");
				} catch (error) {
					aiModelerSetStatus(root, error instanceof Error ? error.message : String(error), true);
				}
			});
		});
		root.querySelector("[data-field=\"preset\"]").addEventListener("change", (event) => {
			const value = event.target.value;
			const preset = aiModelerLoadPresets().find((item) => item.name === value);
			root.querySelector("[data-field=\"style\"]").value = preset ? preset.instructions : "";
		});
	}
	function aiModelerOpenDialog() {
		const references = {
			front: null,
			left: null,
			right: null,
			back: null
		};
		const state = {
			generating: false,
			controller: null
		};
		const content = document.createElement("div");
		content.innerHTML = aiModelerDialogHTML(aiModelerLoadPresets());
		const root = content.querySelector(".ai-modeler-root");
		aiModelerWireDialog(root, references);
		const dialog = new Dialog("ai_modeler_generate", {
			title: "AI Modeler",
			width: 760,
			resizable: "y",
			buttons: ["Generate model", "Cancel"],
			confirmIndex: 0,
			cancelIndex: 1,
			lines: [content],
			onButton(index) {
				if (index === 0) {
					aiModelerGenerate(dialog, root, references, state);
					return false;
				}
				if (state.controller) state.controller.abort();
			}
		});
		dialog.show();
	}
	BBPlugin.register("ai_modeler", {
		title: "AI Modeler",
		author: "AI Modeler",
		description: "Generate editable Blockbench cube models from prompts and reference views.",
		icon: "view_in_ar",
		version: "0.1.0",
		variant: "desktop",
		min_version: "5.2.1",
		onload() {
			window.addEventListener("keydown", aiModelerHandleApiKeyPaste, true);
			aiModelerApiKeySetting = new Setting("ai_modeler_openai_api_key", {
				name: "AI Modeler — OpenAI API key",
				description: "Used directly by AI Modeler. Keep this key private.",
				category: "general",
				plugin: "ai_modeler",
				type: "password",
				value: ""
			});
			aiModelerAction = new Action("ai_modeler_generate", {
				name: "AI Modeler",
				description: "Generate a Blockbench model from a prompt and reference views",
				icon: "view_in_ar",
				click: aiModelerOpenDialog
			});
			MenuBar.menus.tools.addAction(aiModelerAction);
		},
		onunload() {
			window.removeEventListener("keydown", aiModelerHandleApiKeyPaste, true);
			if (aiModelerAction) aiModelerAction.delete();
			if (aiModelerApiKeySetting) aiModelerApiKeySetting.delete();
		}
	});
})();
