// Module declarations for packages without types

declare module '@znemz/sort-object' {
  function sortObject(obj: unknown, options?: Record<string, unknown>): unknown;
  export = sortObject;
}

declare module '@znemz/cft-utils/src/resources/taggable.js' {
  export function isTaggableResource(resourceType: string): Promise<boolean>;
}

declare module 'jmespath' {
  export function search(data: unknown, expression: string): unknown;
}
