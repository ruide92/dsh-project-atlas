import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter, categoryFor, classifyOrigin } from '../skills.js'

test('parses YAML frontmatter and keeps folded descriptions', () => {
  const { meta, body } = parseFrontmatter(`---
name: demo-skill
description: >
  Build a demo
  for the atlas.
metadata:
  version: 1.2.0
---
# Demo
Use this skill.`)
  assert.equal(meta.name, 'demo-skill')
  assert.equal(meta.description, 'Build a demo for the atlas.')
  assert.match(body, /# Demo/)
})

test('classifies source purposes without turning every skill into code', () => {
  assert.equal(categoryFor('wechat-formatting', '公众号排版', 'C:\\x'), '内容写作')
  assert.equal(categoryFor('docx', 'Word documents', 'C:\\x'), '办公数据')
  assert.equal(categoryFor('comfyui-demo', 'ComfyUI video generation', 'C:\\x'), '视频图像')
  assert.equal(categoryFor('cordis-plugin-development', 'Plugin API', 'C:\\x'), '开发工程')
})

test('separates authored skills from marketplace installs', () => {
  assert.equal(classifyOrigin('C:\\Users\\demo\\.codex\\skills\\my-skill\\SKILL.md'), 'authored')
  assert.equal(classifyOrigin('C:\\Users\\demo\\.example-hub\\plugins\\marketplaces\\builtin\\skills\\x\\SKILL.md'), 'installed')
  assert.equal(classifyOrigin('C:/tools/dsh/profiles/desktop/node_modules/pkg/skills/x/SKILL.md'), 'installed')
})
