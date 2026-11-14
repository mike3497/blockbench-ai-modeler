import {describe, expect, it} from 'vitest';
import {validateModel} from './model';

const cube = {name: 'Body', from: [-1, 0, -1], to: [1, 2, 1], rotation: [0, 0, 0], origin: [0, 0, 0]};

describe('validateModel', () => {
	it('accepts valid cube geometry and trims names', () => {
		expect(validateModel({name: ' Fox ', elements: [cube]})).toEqual({name: 'Fox', elements: [cube]});
	});

	it('rejects invalid coordinates and non-positive cube sizes', () => {
		expect(() => validateModel({name: 'Fox', elements: [{...cube, from: [65, 0, 0]}]})).toThrow('invalid cube data');
		expect(() => validateModel({name: 'Fox', elements: [{...cube, from: [1, 0, 0]}]})).toThrow('zero or negative size');
	});

	it('rejects empty and oversized models', () => {
		expect(() => validateModel({name: 'Fox', elements: []})).toThrow('between 1 and 200 cubes');
		expect(() => validateModel({name: 'Fox', elements: Array(201).fill(cube)})).toThrow('between 1 and 200 cubes');
	});
});
