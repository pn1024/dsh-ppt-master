/**
 * dsh-ppt-master bundle entry: registers the packaged
 * `skills/ppt-master/SKILL.md` bundle on `ctx.skills`.
 *
 * Zero-dependency implementation — no external npm packages required.
 * Uses a minimal hand-rolled YAML frontmatter parser sufficient for
 * the SKILL.md format (simple keys, block scalars, nested objects,
 * and arrays).
 *
 * @module dsh-ppt-master
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUNDLED_SKILL_RANK = 600
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PROVIDER_NAME = 'dsh-ppt-master'
const SKILLS_ROOT = fileURLToPath(new URL('./skills/', import.meta.url))

export const name = 'dsh-ppt-master'
export const inject = ['skills']

export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: PROVIDER_NAME,
    async list(options) {
      options?.signal?.throwIfAborted()
      const listed = await loadSkills(options?.signal)
      options?.signal?.throwIfAborted()
      return listed.map(toCandidate)
    },
    async get(candidate, options) {
      options?.signal?.throwIfAborted()
      const listed = await loadSkills(options?.signal)
      const skill = listed.find((entry) => entry.name === candidate.name)
      return skill === undefined ? undefined : toDefinition(skill)
    },
  }))
}

// ─── internal helpers ────────────────────────────────────────────

async function loadSkills(signal) {
  const entries = await readdir(SKILLS_ROOT, { withFileTypes: true, signal })
  const skills = []
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    signal?.throwIfAborted()
    const directory = join(SKILLS_ROOT, entry.name)
    const skillFile = join(directory, 'SKILL.md')
    const parsed = parseSkill(await readFile(skillFile, 'utf8'), directory, skillFile)
    if (parsed !== undefined) skills.push(parsed)
  }
  return [...skills].sort((left, right) => left.name.localeCompare(right.name))
}

function parseSkill(raw, directory, skillFile) {
  const parsed = parseFrontmatter(raw)
  if (parsed === undefined) return undefined
  const data = parsed.data
  const skillName = typeof data.name === 'string' ? data.name.trim() : undefined
  const description = typeof data.description === 'string' ? data.description.trim() : undefined
  if (skillName === undefined || description === undefined) {
    throw new Error(`${PROVIDER_NAME}: ${skillFile} frontmatter requires name and description`)
  }
  if (!SKILL_NAME.test(skillName)) {
    throw new Error(`${PROVIDER_NAME}: invalid skill name "${skillName}"`)
  }
  return {
    name: skillName,
    description,
    ...(typeof data.metadata === 'object' && data.metadata !== null && !Array.isArray(data.metadata)
      ? { metadata: data.metadata }
      : {}),
    invocation: {
      modelInvocable: data['disable-model-invocation'] !== true,
      userInvocable: data['user-invocable'] !== false,
    },
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: directory },
    rank: BUNDLED_SKILL_RANK,
    locator: skillFile,
    path: skillFile,
    content: parsed.body.trim(),
  }
}

function parseFrontmatter(raw) {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  if (raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return undefined
  const start = firstLineEnd + 1
  const closing = findClosingFrontmatter(raw, start)
  if (closing === undefined) return undefined
  const yamlText = raw.slice(start, closing.start)
  const data = parseSimpleYaml(yamlText)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  return { data, body: raw.slice(closing.bodyStart) }
}

function findClosingFrontmatter(raw, start) {
  let lineStart = start
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
      return { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
}

// ─── minimal YAML parser (sufficient for SKILL.md frontmatter) ───

function parseSimpleYaml(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''))
  const result = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // skip blank / comment lines
    if (line.trim() === '' || line.trimStart().startsWith('#')) { i++; continue }

    const indent = line.length - line.trimStart().length
    const trimmed = line.trimStart()

    // key: value  OR  key:  (nested)  OR  key: > / | (block scalar)
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx < 0) { i++; continue }
    const key = trimmed.slice(0, colonIdx).trim()
    let valuePart = trimmed.slice(colonIdx + 1).trim()

    if (valuePart === '>' || valuePart === '|' || valuePart === '>-' || valuePart === '|-') {
      // block scalar — collect following indented lines
      const blockLines = []
      i++
      while (i < lines.length) {
        const bl = lines[i]
        const bIndent = bl.length - bl.trimStart().length
        if (bl.trim() === '') { blockLines.push(''); i++; continue }
        if (bIndent <= indent) break
        blockLines.push(bl.slice(indent + 2)) // remove one indent level
        i++
      }
      // folded (> ) joins with spaces; literal (| ) keeps newlines
      if (valuePart.startsWith('>')) {
        result[key] = blockLines.join(' ').replace(/\s+/g, ' ').trim()
      } else {
        result[key] = blockLines.join('\n').trim()
      }
      continue
    }

    if (valuePart === '') {
      // could be nested object or array
      // peek next non-blank line
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      if (j < lines.length) {
        const nextLine = lines[j]
        const nextIndent = nextLine.length - nextLine.trimStart().length
        if (nextIndent > indent) {
          // collect nested block
          const blockLines = []
          let k = i + 1
          while (k < lines.length) {
            const nl = lines[k]
            const nlIndent = nl.length - nl.trimStart().length
            if (nl.trim() === '') { blockLines.push(nl); k++; continue }
            if (nlIndent <= indent) break
            blockLines.push(nl); k++
          }
          const childText = blockLines.map((l) => l.replace(/^ {2}/, '')).join('\n')
          const childTrimmed = childText.trim()
          if (childTrimmed.startsWith('- ') || childTrimmed.startsWith('-\n') || childTrimmed === '-') {
            // array
            result[key] = childTrimmed.split('\n')
              .filter((l) => l.trim().startsWith('-'))
              .map((l) => {
                const v = l.replace(/^\s*-\s*/, '').trim()
                return stripQuotes(v)
              })
          } else {
            result[key] = parseSimpleYaml(childText)
          }
          i = k
          continue
        }
      }
      result[key] = null
      i++
    } else {
      // inline value
      result[key] = stripQuotes(valuePart)
      i++
    }
  }
  return result
}

function stripQuotes(s) {
  if (typeof s !== 'string') return s
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function toCandidate(skill) {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.metadata !== undefined ? { metadata: skill.metadata } : {}),
    invocation: skill.invocation,
    provider: skill.provider,
    source: skill.source,
    resourceBase: skill.resourceBase,
    rank: skill.rank,
    locator: skill.locator,
    path: skill.path,
  }
}

function toDefinition(skill) {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.metadata !== undefined ? { metadata: skill.metadata } : {}),
    invocation: skill.invocation,
    provider: skill.provider,
    source: skill.source,
    resourceBase: skill.resourceBase,
    path: skill.path,
    content: skill.content,
  }
}
