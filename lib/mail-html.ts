import sanitizeHtml from 'sanitize-html'

const SAFE_CSS_VALUE = /^(?!.*(?:url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|-moz-binding))[\w\s#.,()%/+:'"!\-]+$/i
const SAFE_STYLE_PROPERTIES = [
  'align-items', 'background', 'background-color', 'border', 'border-bottom',
  'border-color', 'border-left', 'border-radius', 'border-right', 'border-style',
  'border-top', 'border-width', 'box-sizing', 'clear', 'color', 'display', 'float',
  'font-family', 'font-size', 'font-style', 'font-weight', 'height', 'justify-content',
  'letter-spacing', 'line-height', 'margin', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width',
  'opacity', 'overflow', 'overflow-wrap', 'padding', 'padding-bottom', 'padding-left',
  'padding-right', 'padding-top', 'table-layout', 'text-align', 'text-decoration',
  'text-transform', 'vertical-align', 'white-space', 'width', 'word-break',
]

const SAFE_STYLES = {
  '*': Object.fromEntries(SAFE_STYLE_PROPERTIES.map((property) => [property, [SAFE_CSS_VALUE]])),
} as Record<string, Record<string, RegExp[]>>

export function sanitizeMailHtml(html: string, allowRemoteImages: boolean) {
  const sanitized = sanitizeHtml(html, {
    // Embedded CSS is sanitized below and rendered only inside a sandboxed CSP iframe.
    allowVulnerableTags: true,
    allowedTags: [...new Set(sanitizeHtml.defaults.allowedTags.concat([
      'style', 'center', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'img',
    ]))],
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title', 'dir', 'lang'],
      a: ['href', 'title', 'class', 'id', 'style'],
      table: ['align', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'height', 'role', 'style', 'width'],
      tr: ['align', 'bgcolor', 'height', 'style', 'valign'],
      td: ['align', 'bgcolor', 'colspan', 'height', 'rowspan', 'style', 'valign', 'width'],
      th: ['align', 'bgcolor', 'colspan', 'height', 'rowspan', 'scope', 'style', 'valign', 'width'],
      img: ['src', 'alt', 'title', 'width', 'height', 'border', 'class', 'id', 'style', 'loading', 'referrerpolicy', 'crossorigin', 'data-remote-blocked'],
    },
    allowedStyles: SAFE_STYLES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }, true),
      img: (_tagName, attributes) => {
        const safeAttributes: Record<string, string> = { ...attributes, loading: 'lazy', referrerpolicy: 'no-referrer', crossorigin: 'anonymous' }
        if (!allowRemoteImages) {
          delete safeAttributes.src
          safeAttributes['data-remote-blocked'] = 'true'
        }
        return { tagName: 'img', attribs: safeAttributes }
      },
    },
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'textarea', 'option', 'noscript', 'template'],
  })

  return sanitized.replace(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    const safeCss = sanitizeEmbeddedCss(css)
    return safeCss ? `<style>${safeCss}</style>` : ''
  })
}

function sanitizeEmbeddedCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@(?:import|charset|namespace)[^;]*;/gi, '')
    .replace(/@font-face\s*\{[^}]*\}/gi, '')
    .replace(/(?:[\w-]+)\s*:\s*[^;{}]*(?:url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding)[^;{}]*;?/gi, '')
    .replace(/position\s*:\s*fixed\s*;?/gi, '')
    .trim()
}
