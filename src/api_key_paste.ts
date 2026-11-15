export function pasteApiKey(readClipboard: () => string, saveApiKey: (value: string) => void): boolean {
	const key = readClipboard().trim();
	if (!key) return false;
	saveApiKey(key);
	return true;
}
