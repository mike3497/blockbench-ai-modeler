export function isApiKeyPasteShortcut(
	event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>,
	targetIsApiKeyInput: boolean
): boolean {
	return targetIsApiKeyInput && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v';
}
