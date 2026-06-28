# vite-plugin-better-enums

TypeScript enums are [famously problematic](https://www.typescriptlang.org/docs/handbook/enums.html) — they compile to IIFEs, they block tree-shaking, and they carry a reverse-mapping table you almost never need.

This plugin rewrites `export enum` declarations at build time into plain named `const` exports in a virtual module, giving you all the ergonomics of enums with none of the baggage.

```js
// ------------
// Before
// ------------

//#region src/fruit.ts
var Fruit = /* @__PURE__ */ (function (Fruit) {
  Fruit[(Fruit["Apple"] = 0)] = "Apple";
  Fruit[(Fruit["Kiwi"] = 1)] = "Kiwi";
  Fruit[(Fruit["Banana"] = 2)] = "Banana";
  return Fruit;
})({});
//#endregion

//#region src/main.ts
console.log(Fruit.Apple);
console.log(Fruit.Banana);
//#endregion

// ------------
// After
// ------------
console.log(0);
console.log(2);
```

Usage stays exactly the same:

```ts
import { Fruit } from "./fruit";

const pick: Fruit = Fruit.Apple; // 1
```

---

## How it works

```ts
// ------------
// input
// ------------
export enum Fruit {
  Apple,
  Kiwi,
  Banana,
}

// ------------
// output (in fruit.ts after transform)
// ------------
import * as Fruit from "\0enum-virtual:/abs/path/fruit.ts::Fruit";
export { Fruit };

// ------------
// generated virtual module
// ------------
export const Apple = 1;
export const Kiwi = 2;
export const Banana = 3;
```

The bundler then inlines all constants at their use sites, leaving zero runtime overhead.

---

## Why

|                              | TypeScript enum | This plugin |
| ---------------------------- | --------------- | ----------- |
| Tree-shakeable               | ✗               | ✓           |
| Works with `isolatedModules` | ✗               | ✓           |
| Serializes cleanly to JSON   | ✗               | ✓           |
| No reverse-mapping bloat     | ✗               | ✓           |
| Familiar import syntax       | ✓               | ✓           |
| Type-safe                    | ✓               | ✓           |

---

## Installation

```sh
npm install -D git+https://github.com/eye-wave/better-enums.git
```

---

## Setup

```ts
// vite.config.ts
import { defineConfig } from "vite";
import betterEnums from "vite-plugin-better-enums";

export default defineConfig({
  plugins: [betterEnums()],
});
```

The plugin runs with `enforce: "pre"` so it transforms your source before esbuild or any other plugin sees it.

---

## Usage

Write enums exactly as you normally would — just make sure they are exported:

```ts
// fruit.ts
export enum Fruit {
  Apple,
  Kiwi,
  Banana,
}
```

Import and use them identically to before:

```ts
import { Fruit } from "./fruit";

function isBanana(f: Fruit): boolean {
  return f === Fruit.Banana;
}
```

Multiple enums in one file work fine:

```ts
export enum Color {
  Red,
  Green,
  Blue,
}
export enum Size {
  Small,
  Medium,
  Large,
}
```

Non-exported enums are left completely untouched.

---

## Values

Members start at `1` and auto-increment:

```ts
export enum Direction {
  North, // 1
  East, // 2
  South, // 3
  West, // 4
}
```

Explicit numeric initializers are supported, and auto-increment resumes from there:

```ts
export enum Status {
  Ok = 200,
  Created, // 201
  BadRequest = 400,
  NotFound, // 401
}
```

Negative initializers work too:

```ts
export enum Offset {
  Before = -1,
  Zero, // 0
  After, // 1
}
```

String initializers are supported for completeness, though the primary use case is numeric enums:

```ts
export enum Role {
  Admin = "admin",
  User = "user",
}
```

---

## Limitations

- **No reverse lookups.** `Fruit[1]` to get `"Apple"` is not supported — and intentionally so. That's the string-name bloat this plugin exists to eliminate.
- **No computed initializers.** Expressions like `Foo = Bar + 1` or `Foo = someConst` (referencing an import) are not evaluated; the member will be `undefined` at runtime. Stick to literals.
- **Exported enums only.** Non-exported enums are ignored and passed through to esbuild unchanged (they will compile to the standard IIFE form).
- **Ambient enums.** `declare enum` statements are ignored entirely, which is correct — they have no runtime representation.

---

## License

MIT
