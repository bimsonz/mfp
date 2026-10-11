import type Ajv from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";

/** A JSON Schema bundle: a document whose `$defs` each carry an absolute `$id`. */
export type Bundle = { $id: string; $defs: Record<string, any> } & Record<string, unknown>;

/** A profile descriptor, as `$defs/Profile` in the wire schema describes it. */
export type Profile = {
  id: string;
  mfp: string;
  title: string;
  prefix?: string;
  vocabularies?: Partial<Record<"verdict.outcome" | "observation.category", string[]>>;
  require?: string[];
  members?: { kind: string; name: string; schema: unknown; required?: boolean }[];
};

export declare const BASE: string;
export declare const CORE: string;
export declare const EXTENSION: string;
export declare const SLOTS: string[];
export declare const kindsOf: (wire: Bundle) => string[];
export declare const loadWire: () => Bundle;
export declare const loadCore: () => Profile;
export declare const ajvWith: (...schemas: Bundle[]) => Ajv;
export declare const validatorFor: (ajv: Ajv, bundle: Bundle, def: string) => ValidateFunction;
export declare const checkProfile: (wire: Bundle, profile: Profile) => string[];
export declare const producerSchema: (wire: Bundle, profile: Profile) => Bundle;
export declare const checkMessages: (wire: Bundle, profile: Profile, messages: [string, unknown][]) => string[];
