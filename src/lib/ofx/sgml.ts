export interface OfxNode {
  name: string;
  value: string;
  children: OfxNode[];
}

const TAG = /<(\/?)([A-Z0-9.]+)>([^<\r\n]*)/g;

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&" };

function decodeEntities(value: string): string {
  return value.replace(/&(?:lt|gt|amp);/g, (entity) => ENTITIES[entity]);
}

/**
 * Builds a tree from OFX 1.x SGML. Value tags may or may not be closed;
 * aggregates are always closed. `unclosed` lists aggregates left open, which
 * means the file was cut short.
 */
export function parseSgml(content: string): { root: OfxNode; unclosed: string[] } {
  const root: OfxNode = { name: "", value: "", children: [] };
  const stack: OfxNode[] = [root];

  for (const [, closing, name, rawValue] of content.matchAll(TAG)) {
    if (closing) {
      const index = stack.findLastIndex((node) => node.name === name);
      if (index > 0) {
        stack.length = index;
      }
      continue;
    }
    const value = rawValue.trim();
    const node: OfxNode = { name, value: decodeEntities(value), children: [] };
    stack[stack.length - 1].children.push(node);
    if (value === "") {
      stack.push(node);
    }
  }
  return { root, unclosed: stack.slice(1).map((node) => node.name) };
}

export function child(node: OfxNode, name: string): OfxNode | undefined {
  return node.children.find((candidate) => candidate.name === name);
}

export function children(node: OfxNode, name: string): OfxNode[] {
  return node.children.filter((candidate) => candidate.name === name);
}

export function descendant(node: OfxNode, ...path: string[]): OfxNode | undefined {
  let current: OfxNode | undefined = node;
  for (const name of path) {
    current = current && child(current, name);
  }
  return current;
}
