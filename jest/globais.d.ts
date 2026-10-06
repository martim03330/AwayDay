// TypeScript 6 no longer loads every @types package by default: the Jest globals (describe, it, expect, jest) for the
// screen tests (*.ui.test.tsx) and jest.setup.ts. The Vitest tests import their own from 'vitest'.
/// <reference types="jest" />
