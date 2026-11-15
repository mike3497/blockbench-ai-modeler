import {expect, it} from 'vitest';
import {pasteApiKey} from './api_key_paste';

it('trims and saves the clipboard API key', () => {
	const saved: string[] = [];
	expect(pasteApiKey(() => ' sk-example ', key => saved.push(key))).toBe(true);
	expect(saved).toEqual(['sk-example']);
});

it('does not replace the current key when the clipboard is empty', () => {
	const saved: string[] = [];
	expect(pasteApiKey(() => '  ', key => saved.push(key))).toBe(false);
	expect(saved).toEqual([]);
});
