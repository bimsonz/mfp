# Bindings

MCP carries what a model asks of tools; MFP is what a model reports back, often carried as MCP tool calls.

A binding says how a model emits MFP through a given channel. This version defines two:
- **structured output:** the model's reply is the message;
- **MCP:** the model reports by calling a tool.

Both use the same model-facing schemas, generated from the producer schema and committed beside it:

| Path | What it is |
|---|---|
| `schema/0.2/emit/<kind>.schema.json` | The structured-output schema for one kind: a whole message |
| `schema/0.2/mcp/<kind>.tool.json` | The MCP tool for one kind, as `tools/list` returns it |

For a profile, `mfp-profile emit <profile.json> <dir>` writes the same files, with the profile's vocabularies and members in them.

## The emit form

Strict structured-output modes accept only a subset of JSON Schema, and treat parts of it unevenly. So every emit schema and tool input:
- has a root of type `object`;
- closes every object (`additionalProperties: false`);
- makes every property required, an optional member being *nullable*: `anyOf: [<schema>, {"type": "null"}]`;
- spells each constant as a single-value `enum`, never `const`;
- is self-contained: its `$defs` are local, and every `$ref` is `#/$defs/<name>`;
- uses only these keywords: `type`, `properties`, `required`, `additionalProperties`, `items`, `enum`, `anyOf`, `$ref`, `$defs`, `description`, `pattern`, `minItems`.

The keywords the emit form drops (`minLength`, `uniqueItems`, `format`, `default`) are still enforced by the wire schema, when the driver checks what the model emitted.

Members come in the order a model should write them: a proposition's subject, predicate, relation and value before its details; a message's report before its `cites` and `confidence`.

### Null means absent

In the emit form, `null` means the member is absent.

A driver MUST turn what the model emitted into a wire message with the transform `toWire`: remove every member whose value is `null`, at any depth. It MUST then validate the result against the wire schema. The wire form never carries `null` for an MFP member, so a producer outside these bindings MUST NOT emit one.

The package ships the transform, and its inverse for examples, as `@bimsonz/mfp/emit`:

```js
import { toWire, toEmit } from "@bimsonz/mfp/emit";
```

## Structured output

A driver that wants a report of one kind asks for structured output with that kind's emit schema, unmodified, named `mfp_<kind>`. With an OpenAI-compatible chat completions API:

```json
{
  "model": "<model>",
  "messages": [
    { "role": "system", "content": "Before you change code, report each thing you rely on about code you do not own as an MFP premise." },
    { "role": "user", "content": "Revocation must take effect on the collaborator's next request. requirePermission in src/authz/check.ts re-reads roles on every request." }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "mfp_premise", "strict": true, "schema": "<schema/0.2/emit/premise.schema.json>" }
  }
}
```

The model replies with a message in the emit form:

```json
{
  "mfp": "0.2",
  "kind": "premise",
  "premise": {
    "subject": "authz.permission-evaluation",
    "predicate": "freshness",
    "relation": "at-most",
    "value": "per-request",
    "strength": null,
    "scope": null,
    "gloss": "requirePermission re-reads roles on every request",
    "anchors": null,
    "cites": null
  },
  "cites": null,
  "confidence": "medium"
}
```

`toWire` gives the wire message, which the driver validates against the wire schema:

```json
{
  "mfp": "0.2",
  "kind": "premise",
  "premise": {
    "subject": "authz.permission-evaluation",
    "predicate": "freshness",
    "relation": "at-most",
    "value": "per-request",
    "gloss": "requirePermission re-reads roles on every request"
  },
  "confidence": "medium"
}
```

A reply that fails validation is not a message. The driver SHOULD give the model the validation errors and ask again.

A provider that does not enforce the schema, or enforces only part of it, is still bound by this: the driver validates every reply.

A driver that cannot constrain decoding at all MAY include the emit schema in the prompt and parse the reply as JSON. The same transform and validation apply.

## MCP

A server that receives MFP over MCP offers one tool per kind, named `mfp_<kind>`. Each tool's definition is the committed `mcp/<kind>.tool.json` (or its profile's):
- `inputSchema` is the kind's emit schema without `mfp`, `kind` and `profile`, which the binding supplies;
- `outputSchema` is the receiver's reply, `{ref}`;
- `description` says what the model reports and when to call the tool. A server MAY add to a description, but SHOULD NOT remove what it says.

The server's `tools/list` result has, with the input schema elided:

```json
{
  "tools": [
    {
      "name": "mfp_premise",
      "title": "Report a premise",
      "description": "Report one more thing you rely on about code you do not own, found after you reported your intent. Call this as soon as you start relying on it.",
      "inputSchema": "<schema/0.2/mcp/premise.tool.json#/inputSchema>",
      "outputSchema": {
        "type": "object",
        "properties": {
          "ref": { "type": "string", "description": "The identifier the receiver gave this report. Cite it later as {kind: \"record\", ref}." }
        },
        "required": ["ref"],
        "additionalProperties": false
      },
      "annotations": { "title": "Report a premise", "readOnlyHint": false, "destructiveHint": false, "idempotentHint": false, "openWorldHint": false }
    }
  ]
}
```

The model reports by calling the tool:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "mfp_premise",
    "arguments": {
      "premise": {
        "subject": "authz.permission-evaluation",
        "predicate": "freshness",
        "relation": "at-most",
        "value": "per-request",
        "strength": null,
        "scope": null,
        "gloss": "requirePermission re-reads roles on every request",
        "anchors": null,
        "cites": null
      },
      "cites": null,
      "confidence": "medium"
    }
  }
}
```

On a call to `mfp_<kind>`, the server:
1. Forms the message: `toWire(arguments)`, with `mfp` set to `"0.2"`, `kind` set to `<kind>`, and `profile` set to its profile's `id` unless that is the core's. For the call above, that is the wire message shown under [structured output](#structured-output).
2. Validates the message against the wire schema and its profile's producer schema.
3. If it is valid, records it, assigns it an identifier, and replies with that identifier as `structuredContent` and as text:

   ```json
   {
     "jsonrpc": "2.0",
     "id": 7,
     "result": {
       "content": [{ "type": "text", "text": "{\"ref\":\"rec_01JZ8R4K6M8P0R2T4V6X8Z0B2D\"}" }],
       "structuredContent": { "ref": "rec_01JZ8R4K6M8P0R2T4V6X8Z0B2D" }
     }
   }
   ```

   The model can then cite the report as `{"kind": "record", "ref": "rec_01JZ8R4K6M8P0R2T4V6X8Z0B2D"}`. The server MUST accept that ref as one it issued.
4. If it is not valid, replies with `isError: true` and the validation errors as text, so the model can correct the call and make it again. It MUST NOT record an invalid message.

Calling a tool is how the model makes a report; it is not evidence of anything the report says ([Security](security.md)). A server that forwards reports to another system forwards the wire message, never the raw arguments.
