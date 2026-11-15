import {expect, it} from 'vitest';
import {isApiKeyPasteShortcut} from './api_key_paste';

it.each([
	[{key: 'v', ctrlKey: true, metaKey: false}, true, true],
	[{key: 'V', ctrlKey: false, metaKey: true}, true, true],
	[{key: 'x', ctrlKey: true, metaKey: false}, true, false],
	[{key: 'v', ctrlKey: true, metaKey: false}, false, false]
])('recognizes API-key paste only for Ctrl/Cmd+V in its field', (event, isApiKeyInput, expected) => {
	expect(isApiKeyPasteShortcut(event, isApiKeyInput)).toBe(expected);
});
