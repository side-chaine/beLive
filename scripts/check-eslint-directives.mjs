#!/usr/bin/env node
// Гейт синтаксиса eslint-директив.
//
// Причина: ESLint парсит ВЕСЬ хвост после имени правила как список имён правил.
// Поэтому свободный текст в директиве даёт «Definition for rule '<кусок текста>'
// was not found» — ошибка выглядит как отсутствие правила, а на деле это сломанная
// директива. Дважды стоило времени: FZ-4 в N1b (`[FROZEN-REQUEST …]` в директиве)
// и em-dash в AiExpertPanel.tsx (одиночное «—» вместо разделителя `--`).
//
// Правило: после списка правил допустим только конец комментария или разделитель
// `--` и любой текст после него. Голая директива (`/* eslint-disable */`) валидна.
//
//   node scripts/check-eslint-directives.mjs
//
// Проверяется только синтаксис. Это не стиль и не запрет eslint-disable:
// осмысленность директивы — дело `--report-unused-disable-directives`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// src — только .ts/.tsx (как линтует eslint.config.mjs); scripts — .mjs.
// Вендорный .mjs в src не сканируется: он в ignores ESLint, директива там инертна.
const SCAN = [
  { dir: join(ROOT, 'src'), exts: new Set(['.ts', '.tsx']) },
  { dir: join(ROOT, 'scripts'), exts: new Set(['.mjs']) },
]
// Директива должна начинать комментарий — иначе это проза о директиве, а не она.
const DIRECTIVE = /^\s*(?:\/\/|\/\*+)\s*(eslint-disable-next-line|eslint-disable-line|eslint-disable)(?![\w-])(.*)$/
// Имя правила: буквы/цифры/@/_/./- и слэш. Всё прочее — уже не имя правила.
const RULE_NAME = /^[@\w][\w@./-]*$/

function walk(dir, exts, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, exts, out)
    } else if (exts.has(extname(full))) {
      out.push(full)
    }
  }
  return out
}

// Возвращает текст невалидной части или null, если директива валидна.
function invalidPart(body) {
  const dash = body.indexOf('--')
  const rulesPart = (dash === -1 ? body : body.slice(0, dash)).trim()
  if (rulesPart === '') {
    return null // /* eslint-disable */ — валидно
  }
  for (const raw of rulesPart.split(',')) {
    const name = raw.trim()
    if (!RULE_NAME.test(name)) {
      return raw.trim() || raw
    }
  }
  return null
}

const files = SCAN.flatMap(({ dir, exts }) => walk(dir, exts, []))
const problems = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const m = line.match(DIRECTIVE)
    if (!m) {
      return
    }
    const body = m[2].replace(/\*\/\s*$/, '')
    const bad = invalidPart(body)
    if (bad === null) {
      return
    }
    problems.push({
      where: `${relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}`,
      text: line.trim().slice(0, 160),
      bad,
    })
  })
}

if (problems.length === 0) {
  console.log(`✓ eslint-директивы: ${files.length} файлов, синтаксис чист`)
  process.exit(0)
}

console.error(`✗ eslint-директивы: ${problems.length} сломанных — ESLint не поймёт их как директиву:`)
for (const p of problems) {
  console.error(`  ${p.where}`)
  console.error(`    ${p.text}`)
  console.error(`    не имя правила: «${p.bad}» — нужен разделитель «--» перед текстом`)
}
console.error('Формат: // eslint-disable-next-line rule-name -- причина')
process.exit(1)
