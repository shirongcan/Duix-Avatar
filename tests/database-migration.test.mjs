import assert from 'node:assert/strict'
import test from 'node:test'
import migrations from '../src/main/db/sql.js'

test('keeps base subtitle fields in version 4 for version 3 databases', () => {
  const migration = migrations.find((item) => item.version === 4)
  assert.ok(migration)
  for (const name of ['subtitle_style', 'subtitle_timing']) {
    assert.match(migration.script, new RegExp(`alter table video add ${name} text`, 'i'))
  }
})

test('upgrades existing version 8 databases with dual output fields', () => {
  const migration = migrations.find((item) => item.version === 9)
  assert.ok(migration)
  for (const name of [
    'clean_file_path',
    'subtitled_file_path',
    'subtitle_render_status',
    'subtitle_render_message'
  ]) assert.match(migration.script, new RegExp(`alter table video add ${name} text`, 'i'))
})

test('upgrades existing version 9 databases with a speech speed field', () => {
  const migration = migrations.find((item) => item.version === 10)
  assert.ok(migration)
  assert.equal(migrations.at(-1).version, 10)
  assert.match(migration.script, /alter table video add speed real default 1\.0/i)
})
