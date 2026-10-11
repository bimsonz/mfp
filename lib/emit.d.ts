import type { Bundle } from "./profile.js";

/** A self-contained, closed JSON Schema in the portable subset. */
export type EmitSchema = Record<string, any> & { type: "object"; properties: Record<string, any>; required: string[] };

/** An MCP tool definition, as `tools/list` returns one. */
export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: EmitSchema;
  outputSchema: EmitSchema;
  annotations: Record<string, unknown>;
};

export declare const PORTABLE: string[];
export declare const BINDING_MEMBERS: string[];
export declare const BASE: string;
export declare const CORE: string;
export declare const emitSchema: (producer: Bundle, kind: string) => EmitSchema;
export declare const mcpTool: (producer: Bundle, kind: string) => McpTool;
export declare const bindings: (wire: Bundle, producer: Bundle) => { kind: string; schema: EmitSchema; tool: McpTool }[];
export declare const toWire: (output: unknown, binding?: { kind: string; profile?: string }) => any;
export declare const toEmit: (message: unknown, schema: EmitSchema) => any;
