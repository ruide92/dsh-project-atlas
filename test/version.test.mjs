import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('release version, UI label and install URLs stay in sync', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const client = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(client.includes(`'v${pkg.version}'`), true, 'client UI version is stale')
  assert.equal(pkg.dsh.install.tarball.includes(`/v${pkg.version}/dsh-project-atlas-${pkg.version}.tgz`), true)
  assert.equal(pkg.dsh.install.zip.includes(`/v${pkg.version}.zip`), true)
})
