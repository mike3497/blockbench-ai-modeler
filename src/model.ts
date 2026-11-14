export type Vector3 = [number, number, number];
type ModelElement = {name: string; from: Vector3; to: Vector3; rotation: Vector3; origin: Vector3};
export type GeneratedModel = {name: string; elements: ModelElement[]};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isVector(value: unknown, maxAbs = 64): value is Vector3 {
	return Array.isArray(value) && value.length === 3 && value.every((item: unknown) =>
		typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= maxAbs
	);
}

export function validateModel(value: unknown): GeneratedModel {
	if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) throw new Error('The model response needs a name.');
	if (!Array.isArray(value.elements) || value.elements.length < 1 || value.elements.length > 200) {
		throw new Error('The model must contain between 1 and 200 cubes. Try a simpler prompt.');
	}
	const elements = value.elements.map((element: unknown): ModelElement => {
		if (!isRecord(element) || typeof element.name !== 'string' || !isVector(element.from) || !isVector(element.to) ||
			!isVector(element.rotation, 180) || !isVector(element.origin)) {
			throw new Error('The model response contains invalid cube data.');
		}
		const from = element.from;
		const to = element.to;
		const rotation = element.rotation;
		const origin = element.origin;
		if (from.some((coordinate, index) => coordinate >= to[index])) {
			throw new Error('The model response contains a cube with zero or negative size.');
		}
		return {name: element.name.trim().slice(0, 64) || 'Cube', from, to, rotation, origin};
	});
	return {name: value.name.trim().slice(0, 64), elements};
}
