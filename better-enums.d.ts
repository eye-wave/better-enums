import type { Plugin } from "vite";

/**
 * Vite plugin that rewrites `export enum` declarations into tree-shakeable
 * named const exports via virtual modules.
 *
 * ```ts
 * // Before (fruit.ts)
 * export enum Fruit { Apple, Banana, Kiwi }
 *
 * // After (fruit.ts)
 * export * as Fruit from "\0enum:/abs/path/fruit.ts?Fruit";
 * export type Fruit = 1 | 2 | 3;
 *
 * // Virtual module (\0enum:/abs/path/fruit.ts?Fruit)
 * export const Apple = 1;
 * export const Banana = 2;
 * export const Kiwi = 3;
 * ```
 *
 * Enum members with initializers are explicitly unsupported and will throw
 * a build error.
 */
export default function betterEnums(): Plugin;
