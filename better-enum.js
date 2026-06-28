import * as oxc from "oxc-parser";
import path from "node:path";

const VIRTUAL_PREFIX = "\0enum-virtual:";

function resolveMembers(enumNode) {
  const members = enumNode.body.members;
  const resolved = [];
  const byName = {};
  let counter = 1;

  for (const member of members) {
    const name =
      member.id.type === "Identifier" ? member.id.name : member.id.value;

    let value;
    if (!member.initializer) {
      value = counter++;
    } else {
      value = evalInitializer(member.initializer, byName);
      if (typeof value === "number") counter = value + 1;
      else counter = NaN;
    }

    byName[name] = value;
    resolved.push({ name, value });
  }

  return resolved;
}

function evalInitializer(node, byName) {
  if (node.type === "Literal") return node.value;

  if (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument?.type === "Literal" &&
    typeof node.argument.value === "number"
  ) {
    return -node.argument.value;
  }

  if (node.type === "Identifier" && node.name in byName) {
    return byName[node.name];
  }

  return undefined;
}

function emitVirtualModule(members) {
  return members
    .map(({ name, value }) => {
      if (value === undefined) return `export const ${name} = undefined;`;
      if (typeof value === "string")
        return `export const ${name} = ${JSON.stringify(value)};`;
      return `export const ${name} = ${value};`;
    })
    .join("\n");
}

export function betterEnums() {
  const virtualModules = new Map();

  return {
    name: "vite-plugin-better-enums",

    enforce: "pre",

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) return id;
    },

    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return;
      const src = virtualModules.get(id);
      if (src != null) return { code: src, map: null };
    },

    transform(code, id) {
      if (!/\.[cm]?tsx?$/.test(id)) return;
      if (!code.includes("enum ")) return;

      const parsed = oxc.parseSync(path.basename(id), code, {
        sourceType: "module",
      });

      if (parsed.errors?.some((e) => e.severity === "Error")) return;

      const replacements = [];
      const reexports = [];

      for (const node of parsed.program.body) {
        let enumNode = null;
        let isExported = false;
        let nodeStart, nodeEnd;

        if (node.type === "TSEnumDeclaration") {
          enumNode = node;
          nodeStart = node.start;
          nodeEnd = node.end;
        } else if (
          node.type === "ExportNamedDeclaration" &&
          node.declaration?.type === "TSEnumDeclaration"
        ) {
          enumNode = node.declaration;
          isExported = true;
          nodeStart = node.start;
          nodeEnd = node.end;
        }

        if (!enumNode) continue;

        const enumName = enumNode.id.name;
        const members = resolveMembers(enumNode);
        const vid = `${VIRTUAL_PREFIX}${id}::${enumName}`;

        virtualModules.set(vid, emitVirtualModule(members));

        const importLine = `import * as ${enumName} from ${JSON.stringify(vid)};`;
        replacements.push({
          start: nodeStart,
          end: nodeEnd,
          replacement: importLine,
        });

        if (isExported) {
          reexports.push(`export { ${enumName} };`);
        }
      }

      if (replacements.length === 0) return;

      replacements.sort((a, b) => b.start - a.start);

      let out = code;
      for (const { start, end, replacement } of replacements) {
        out = out.slice(0, start) + replacement + out.slice(end);
      }

      if (reexports.length) {
        out += "\n" + reexports.join("\n") + "\n";
      }

      return { code: out, map: null };
    },
  };
}

export default betterEnums;
