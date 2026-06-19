import { parse } from "@typescript-eslint/typescript-estree";

const VIRTUAL_PREFIX = "\0enum:";

/**
 * @param {string} source
 * @param {string} filePath  - absolute path, used only for error messages
 * @returns {{ name: string, members: string[] }[]}
 */
function extractEnums(source, filePath) {
  let ast;
  try {
    ast = parse(source, {
      jsx: filePath.endsWith("x"), // .tsx / .jsx
      range: false,
      loc: false,
    });
  } catch (err) {
    return [];
  }

  const enums = [];

  for (const node of ast.body) {
    if (
      node.type !== "ExportNamedDeclaration" ||
      node.declaration?.type !== "TSEnumDeclaration"
    ) {
      continue;
    }

    const decl = node.declaration;
    const name = decl.id.name;
    const members = [];

    for (const member of decl.body.members) {
      if (member.initializer !== undefined) {
        throw new Error(
          `[vite-plugin-better-enums] Enum initializers are not supported.\n` +
            `  Found initializer on member "${member.id.name ?? member.id.value}" ` +
            `in enum "${name}" at ${filePath}.\n` +
            `  Remove the initializer or exclude this file from the plugin.`,
        );
      }

      const memberName =
        member.id.type === "Identifier" ? member.id.name : member.id.value;

      members.push(memberName);
    }

    enums.push({ name, members });
  }

  return enums;
}

/**
 * builds replacement source for the original file.
 * every `export enum Foo { ... }` becomes:
 *   export * as Foo from "<virtual>";
 *   export type Foo = 1 | 2 | 3 ...;
 *
 * all other content in the file is preserved unchanged
 *
 * @param {string} source
 * @param {{ name: string, members: string[] }[]} enums
 * @param {string} filePath
 * @returns {string}
 */
function buildShim(source, enums, filePath) {
  let result = source;

  for (const { name, members } of enums) {
    const virtualId = buildVirtualId(filePath, name);

    const enumPattern = new RegExp(
      `export\\s+(?:const\\s+)?enum\\s+${name}\\s*\\{[^}]*\\}`,
      "s",
    );

    const shim =
      `import * as ${name} from ${JSON.stringify(virtualId)};\n` +
      `export { ${name} };\n`;

    result = result.replace(enumPattern, shim);
  }

  return result;
}

/**
 * Builds the virtual module source: one `export const` per member, 1-indexed.
 *
 * @param {{ name: string, members: string[] }} enumDef
 * @returns {string}
 */
function buildVirtualModule({ members }) {
  return members
    .map((member, i) => `export const ${member} = ${i + 1};`)
    .join("\n");
}

function buildVirtualId(filePath, enumName) {
  return `${VIRTUAL_PREFIX}${filePath}?${enumName}`;
}

/** @returns {import('vite').Plugin} */
export function betterEnums() {
  const enumCache = new Map();

  return {
    name: "better-enums",
    enforce: "pre",

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return id;
      }

      // when the shim we emit does  import("...\0enum:...") vite will call
      // resolveId with the raw string we put in the import specifier
      // re-return it so vite knows it's virtual
      if (id.startsWith("\0")) return id;
    },

    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return;

      // id = `\0enum:/abs/path/to/file.ts?EnumName`
      const withoutPrefix = id.slice(VIRTUAL_PREFIX.length);
      const qmark = withoutPrefix.lastIndexOf("?");
      const filePath = withoutPrefix.slice(0, qmark);
      const enumName = withoutPrefix.slice(qmark + 1);

      const enums = enumCache.get(filePath);
      if (!enums) {
        throw new Error(
          `[vite-plugin-better-enums] Virtual module requested before source was transformed: ${id}`,
        );
      }

      const enumDef = enums.find((e) => e.name === enumName);
      if (!enumDef) {
        throw new Error(
          `[vite-plugin-better-enums] Unknown enum "${enumName}" in ${filePath}`,
        );
      }

      return buildVirtualModule(enumDef);
    },

    transform(source, id) {
      // only handle ts and tsx files
      if (!/\.[cm]?tsx?$/.test(id)) return;

      // skip node_modules
      if (id.includes("node_modules")) return;

      // skip our own virtual modules
      if (id.startsWith(VIRTUAL_PREFIX)) return;

      let enums;
      try {
        enums = extractEnums(source, id);
      } catch (err) {
        // surface initializer errors as build errors
        this.error(err.message);
        return;
      }

      if (enums.length === 0) return;

      enumCache.set(id, enums);

      const code = buildShim(source, enums, id);
      return { code, map: null };
    },
  };
}
