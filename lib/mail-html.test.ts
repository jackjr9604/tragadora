import assert from 'node:assert/strict'
import test from 'node:test'
import { mailDocument } from './mail-document'
import { sanitizeMailHtml } from './mail-html'

test('bloquea contenido activo y recursos remotos por defecto', () => {
  const result = sanitizeMailHtml('<script>alert(1)</script><iframe src="https://bad.test"></iframe><img src="https://tracker.test/pixel"><p>Seguro</p>', false)
  assert.equal(result.includes('script'), false)
  assert.equal(result.includes('iframe'), false)
  assert.equal(result.includes('tracker.test'), false)
  assert.match(result, /Seguro/)
})

test('solo permite imágenes web explícitas sin credenciales ni referrer', () => {
  const result = sanitizeMailHtml('<img src="https://images.test/a.png" onerror="alert(1)"><img src="data:image/png;base64,abc">', true)
  assert.match(result, /https:\/\/images\.test\/a\.png/)
  assert.match(result, /crossorigin="anonymous"/)
  assert.match(result, /referrerpolicy="no-referrer"/)
  assert.equal(result.includes('onerror'), false)
  assert.equal(result.includes('data:image'), false)
})

test('el documento aislado aplica CSP diferente según consentimiento', () => {
  assert.match(mailDocument('<p>Hola</p>', false), /img-src 'none'/)
  assert.match(mailDocument('<p>Hola</p>', true), /img-src http: https:/)
  assert.match(mailDocument('', true), /form-action 'none'/)
})

test('preserva una newsletter con tabla, CSS embebido y botón CTA', () => {
  const newsletter = `
    <style>
      .wrapper { width: 640px; margin: 0 auto; background-color: #ffffff; }
      .cta { display: inline-block; padding: 14px 24px; background: #d4a72c; color: #071426; border-radius: 8px; text-decoration: none; }
      @media (max-width: 680px) { .wrapper { width: 100% !important; } }
    </style>
    <table class="wrapper" width="640" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
      <tr><td style="padding: 32px; text-align: center;">
        <a class="cta" href="https://example.com/action" style="display: inline-block; padding: 14px 24px; background-color: #d4a72c; color: #071426; border-radius: 8px; text-decoration: none;">Ver oferta</a>
      </td></tr>
    </table>`
  const result = sanitizeMailHtml(newsletter, false)
  assert.match(result, /<style>/)
  assert.match(result, /\.wrapper\s*\{\s*width: 640px/)
  assert.match(result, /class="wrapper"/)
  assert.match(result, /width="640"/)
  assert.match(result, /display: inline-block/)
  assert.match(result, /border-radius: 8px/)
  assert.match(result, />Ver oferta<\/a>/)
})

test('elimina cargas CSS remotas y propiedades ejecutables sin perder estilos seguros', () => {
  const result = sanitizeMailHtml(`
    <style>@import url('https://bad.test/a.css'); .card { color: #123456; background-image: url('https://bad.test/pixel'); position: fixed; padding: 20px; }</style>
    <div class="card" style="color:#123456;background-image:url('https://bad.test/pixel');padding:20px" onclick="alert(1)">Contenido</div>
  `, true)
  assert.equal(result.includes('@import'), false)
  assert.equal(result.includes('bad.test'), false)
  assert.equal(result.includes('position: fixed'), false)
  assert.equal(result.includes('onclick'), false)
  assert.match(result, /color:\s*#123456/)
  assert.match(result, /padding:\s*20px/)
})

test('mantiene dimensiones al bloquear la fuente de una imagen remota', () => {
  const blocked = sanitizeMailHtml('<img src="https://images.test/hero.png" width="600" height="240" style="width:600px;height:240px">', false)
  assert.equal(blocked.includes('images.test'), false)
  assert.match(blocked, /width="600"/)
  assert.match(blocked, /height="240"/)
  assert.match(blocked, /data-remote-blocked="true"/)
})
