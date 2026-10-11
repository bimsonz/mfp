# Security considerations

## A message is a claim

An MFP message is what a model says. It is never evidence, whatever it contains.

A consumer MUST NOT raise a claim's standing from the claim's own content. No member, value or extension can make a message proof, a ruling, an approval, or the word of anyone in particular. That includes:
- `confidence`;
- a `verdict`'s `outcome`;
- a citation;
- a profile;
- a vendor extension;
- any text.

Standing comes only from the layer that receives the message, from facts the receiver establishes itself:
- who sent the message, over which authenticated channel;
- on whose behalf;
- what the receiver itself executed or checked.

A receiver that keeps messages as records SHOULD bind each one to those facts in a form the model cannot write: for example, a signed attestation whose subject is the message.

This is why MFP 0.2 has no evidence class, author, signature or supersession. In 0.1 those were fields in the message, so a model could label its own claim `proof` and author its own approval.

In particular:
- A `verdict` is an opinion. A consumer MUST NOT carry out its outcome as a decision. It MAY use the verdict to route work, e.g. to ask for review sooner.
- `confidence` MUST NOT be used as evidence, a weight or a score. It is the model's opinion of its own report.
- A model can cite a test result that never passed, or anchor a claim to a symbol that does not exist. A citation tells a consumer where to look, not what it will find.

## Refs

Every `ref`, and a stance's `decision`, is supplied by the model. A model can reproduce an identifier it was given, misremember one, or invent one.

A consumer MUST check each ref against the identifiers it, or its driver, issued to that model. A ref that was not issued is a defect in the message.
- A consumer MUST NOT resolve such a ref to whatever it happens to name, e.g. another session's message or another tenant's record.
- It SHOULD report the defect to the producer.

Anchors are model-supplied too.
- A consumer MUST treat `path` as relative to the repository the driver is working in, and MUST refuse a path that escapes it, e.g. through `..` segments or an absolute path.
- A `commit` may not exist, or may not be an ancestor of the work.

## Text a model wrote

Free-text members carry whatever the model wrote, and a model can be steered by hostile input it read along the way: an issue, a file, a web page, a tool result. These members are:
- `goal`, `rationale`, `chosen`, `question`, `option`, `reasonRejected`;
- `summary`, `argument`, `residualRisk`;
- `gloss`, an `invariant`'s value, and `title`.

Any of them may contain text addressed to the next reader: instructions for another model, links, or markup.

A consumer:
- MUST present such text to another model as quoted data attributed to its producer, never as instructions;
- MUST escape it before rendering it as HTML, Markdown or terminal output;
- MUST NOT execute it, or anything it names, without its own decision to.

## Profiles and schemas

A `profile` URI names a profile; it is not an instruction to fetch one.
- A consumer MUST NOT dereference an unknown profile URI automatically.
- A consumer SHOULD treat a profile it does not know as the core profile for reading.

A profile descriptor's member schemas are third-party input to a JSON Schema validator. A consumer that compiles them SHOULD bound what they can cost, such as regular expression complexity and schema depth.

## Size

Shapes are recursive, and lists are unbounded in the schema. A consumer SHOULD bound:
- message size;
- list lengths;
- shape depth;

and SHOULD refuse a message that exceeds them, rather than truncate it.

## Privacy

A message can contain anything the model saw: code, paths, customer data, secrets. MFP 0.2 has no privacy class: what may be stored, shown or shared is the receiver's policy.

- A producer SHOULD NOT include secrets or personal data a report does not need.
- A receiver SHOULD apply its own classification and redaction before it stores or forwards a message.
