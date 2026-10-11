import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, root } from "./support.ts";

// How the repository is run: its proposals, its documents' links, its changelog
// and its contacts.
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
/** Every Markdown file in the repository, committed or not, that git does not ignore. */
const markdown = git("ls-files", "--cached", "--others", "--exclude-standard", "*.md").split("\n").filter(Boolean);

/** A proposal's header fields: `- **Key:** value` lines. */
const header = (text: string) => Object.fromEntries([...text.matchAll(/^- \*\*([A-Za-z ]+):\*\* (.+)$/gm)].map(([, k, v]) => [k, v!.trim()]));

describe("T16: proposals", () => {
  const TYPES = ["Standards Track", "Process", "Informational"];
  const STATUSES = ["Draft", "In-Review", "Accepted", "Final", "Rejected", "Withdrawn", "Superseded"];
  const dir = join(root, "proposals");
  const files = readdirSync(dir).filter((f) => f !== "README.md" && f !== "0000-template.md");
  const proposals = files.map((file) => {
    const text = readFileSync(join(dir, file), "utf8");
    return { file, text, title: /^# (.+)$/m.exec(text)?.[1] ?? "", fields: header(text) };
  });
  const index = readFileSync(join(dir, "README.md"), "utf8");

  it("has proposals to check", () => expect(proposals.length).toBeGreaterThan(0));
  it.each(proposals)("$file is named NNNN-short-title.md and titled with its number", ({ file, title }) => {
    expect(file).toMatch(/^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/);
    expect(title.startsWith(`${file.slice(0, 4)}: `)).toBe(true);
  });
  it("numbers proposals once each, from 0001", () => {
    const numbers = proposals.map(({ file }) => Number(file.slice(0, 4))).toSorted((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
  it.each(proposals)("$file has a known type and status, and is indexed with them", ({ file, title, fields }) => {
    expect(TYPES).toContain(fields.Type);
    expect(STATUSES).toContain(fields.Status);
    expect(fields.Created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const name = title.slice(6);
    expect(index).toContain(`| [${file.slice(0, 4)}](${file}) | ${name} | ${fields.Type} | ${fields.Status} |`);
  });
  it.each(proposals.filter(({ fields }) => fields.Status === "Final"))("$file, Final, names real commits", ({ fields }) => {
    const commits = (fields.Implementation ?? "").split(/,\s*/);
    for (const sha of commits) {
      expect(sha).toMatch(/^[0-9a-f]{7,40}$/);
      expect(() => git("cat-file", "-e", `${sha}^{commit}`)).not.toThrow();
    }
  });
  it.each(proposals.filter(({ fields }) => fields.Status === "Final" && fields.Type === "Standards Track"))(
    "$file, Final, names conformance cases that exist",
    ({ fields }) => {
      const cases = [...(fields.Conformance ?? "").matchAll(/`([a-z]+\.[a-z0-9-]+)`/g)].map(([, name]) => name!);
      expect(cases.length).toBeGreaterThan(0);
      for (const name of cases) expect(existsSync(join(root, `conformance/0.2/invalid/${name}.json`))).toBe(true);
    },
  );
  it.each(proposals.filter(({ fields }) => fields.Status === "Superseded"))("$file, Superseded, names its successor", ({ fields }) => {
    expect(fields["Superseded by"]).toMatch(/^\d{4}$/);
  });
});

/** A heading's anchor, as GitHub makes it. */
const slug = (heading: string) =>
  heading
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replaceAll(/\s/g, "-");

/** Every anchor a Markdown file defines, with GitHub's suffixes for repeated headings. */
const anchorsOf = (text: string): Set<string> => {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  for (const [, heading] of withoutCode(text).matchAll(/^#{1,6} (.+)$/gm)) {
    const base = slug(heading!);
    const n = seen.get(base) ?? 0;
    anchors.add(n === 0 ? base : `${base}-${n}`);
    seen.set(base, n + 1);
  }
  return anchors;
};

/** A document without its fenced code blocks and inline code, where a bracket is not a link. */
const withoutCode = (text: string) => text.replaceAll(/^```[\s\S]*?^```/gm, "").replaceAll(/`[^`\n]*`/g, "");

/** The file a link in `file` points at, and its anchor. */
const resolve = (file: string, target: string) => {
  const [path, anchor] = target.split("#") as [string, string | undefined];
  return { path: path === "" ? join(root, file) : join(root, dirname(file), decodeURIComponent(path)), anchor };
};

describe("T17: relative links and anchors resolve", () => {
  const links = markdown.flatMap((file) =>
    [...withoutCode(readFileSync(join(root, file), "utf8")).matchAll(/\]\(([^)\s]+)\)/g)]
      .map(([, target]) => target!)
      .filter((target) => !/^[a-z]+:/i.test(target))
      .map((target): [string, string] => [file, target]),
  );
  it("has links to check", () => expect(links.length).toBeGreaterThan(20));
  it.each(links)("%s → %s", (file, target) => {
    const { path } = resolve(file, target);
    expect(relative(root, path).startsWith("..")).toBe(false);
    expect(existsSync(path)).toBe(true);
  });
  const anchored = links.filter(([file, target]) => {
    const { path, anchor } = resolve(file, target);
    return anchor !== undefined && path.endsWith(".md") && existsSync(path) && statSync(path).isFile();
  });
  it("has anchors to check", () => expect(anchored.length).toBeGreaterThan(3));
  it.each(anchored)("%s → %s names a heading", (file, target) => {
    const { path, anchor } = resolve(file, target);
    expect([...anchorsOf(readFileSync(path, "utf8"))]).toContain(anchor);
  });
});

describe("T18: the changelog", () => {
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const sections = [...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map(([, name]) => name!);
  it("has a section for the package's version, or Unreleased first", () => {
    const { version } = readJson("package.json");
    expect(sections.includes(version) || sections[0] === "Unreleased").toBe(true);
  });
  it("has a section for every release tag", () => {
    const tags = git("tag", "-l", "v*").split("\n").filter(Boolean);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(sections).toContain(tag.slice(1));
  });
  it("links every section", () => {
    for (const name of sections) expect(changelog).toMatch(new RegExp(`^\\[${name.replaceAll(".", "\\.")}\\]: https://`, "m"));
  });
});

describe("T21: every contact is filled in", () => {
  // Spelled in two parts, so this file does not hold the marker it looks for.
  const MARKER = ["CONTACT", "PENDING"].join("-");
  it("leaves no contact pending", () => {
    const pending = spawnSync("git", ["-C", root, "grep", "--untracked", "-l", MARKER], { encoding: "utf8" });
    expect(pending.stdout.split("\n").filter(Boolean)).toEqual([]);
  });
});
