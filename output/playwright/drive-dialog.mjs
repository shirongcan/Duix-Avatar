import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { _electron } = require('playwright-core')

const PW_ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const results = {}

const app = await _electron.launch({
  executablePath: 'D:/heygem/node_modules/electron/dist/electron.exe',
  args: ['.'],
  cwd: 'D:/heygem'
})

try {
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(5000)

  await win.screenshot({ path: `${PW_ROOT}01-home.png` })

  const openBtn = win.getByText('背景替换', { exact: true }).first()
  const openCount = await openBtn.count()
  results.openButtonCount = openCount
  if (openCount > 0) {
    await win.locator('.li').first().hover()
    await win.waitForTimeout(500)
    await openBtn.click()
    await win.waitForTimeout(2000)
    await win.screenshot({ path: `${PW_ROOT}02-background-dialog.png` })

    // switch to image type (upload button) and an edge mode (slider)
    await win.getByText('图片背景', { exact: true }).click()
    await win.waitForTimeout(400)
    await win.getByText('羽化', { exact: true }).click()
    await win.waitForTimeout(400)
    await win.screenshot({ path: `${PW_ROOT}03-dialog-image-edge.png` })

    results.dialogState = await win.evaluate(() => {
      const pick = (el) => {
        if (!el) return null
        const cs = getComputedStyle(el)
        return { text: el.textContent.trim().slice(0, 20), color: cs.color, bg: cs.backgroundColor, border: cs.borderColor }
      }
      const dlg = [...document.querySelectorAll('.t-dialog')].find((d) => d.getBoundingClientRect().width > 100)
      if (!dlg) return { error: 'no visible dialog' }
      const out = { panelBg: getComputedStyle(dlg).backgroundColor, radioGroups: [], buttons: [], slider: null, uploadBtn: null }
      document.querySelectorAll('.t-radio-group--filled').forEach((g) => {
        out.radioGroups.push({ groupBg: getComputedStyle(g).backgroundColor, items: [...g.querySelectorAll('.t-radio-button')].map(pick) })
      })
      document.querySelectorAll('.t-button').forEach((b) => {
        const t = b.textContent.trim()
        if (t) out.buttons.push(pick(b))
      })
      const slider = dlg.querySelector('.t-slider')
      if (slider) {
        out.slider = { rail: pick(slider.querySelector('.t-slider__rail')), track: pick(slider.querySelector('.t-slider__track')), handle: pick(slider.querySelector('.t-slider__button')) }
      }
      out.uploadBtn = pick([...dlg.querySelectorAll('.t-button')].find((b) => /上传|选择/.test(b.textContent)))
      return out
    })
    writeFileSync(`${PW_ROOT}computed-after.json`, JSON.stringify(results.dialogState, null, 2))
  } else {
    results.note = 'no 背景替换 button visible; dumped DOM text sample'
    results.text = await win.evaluate(() => document.body.innerText.slice(0, 1500))
  }
} finally {
  await app.close().catch(() => {})
}

console.log(JSON.stringify(results, null, 2))
