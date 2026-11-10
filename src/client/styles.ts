const STYLE_ID = 'dsh-suggest-card-styles'

export function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.dsh-sc{position:relative;margin:12px 0 0;padding:14px 40px 14px 16px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 4%,var(--dsh-bg-elevated,#f7f7f5));color:var(--dsh-text-secondary,#4a4a46);font:13px/1.55 inherit;box-sizing:border-box;max-width:100%}
.dsh-sc:focus,.dsh-sc:focus-visible{outline:2px solid color-mix(in srgb,#111 45%,transparent);outline-offset:2px}
.dsh-sc-summary{margin:0 0 10px;color:var(--dsh-text-secondary,#4a4a46)}
.dsh-sc-question{margin:0 0 12px;font-weight:650;color:var(--dsh-text-primary,#1d1d1b);font-size:14px;line-height:1.4}
.dsh-sc-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dsh-sc-primary,.dsh-sc-secondary{font:inherit;font-size:13px;line-height:1.2;border-radius:999px;padding:6px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.dsh-sc-primary{background:var(--dsh-text-primary,#1a1a18);color:var(--dsh-bg-elevated,#fff);border:1px solid transparent}
.dsh-sc-primary:hover{filter:brightness(1.08)}
.dsh-sc-primary:disabled,.dsh-sc-secondary:disabled{opacity:.55;cursor:not-allowed}
.dsh-sc-secondary{background:transparent;color:var(--dsh-text-primary,#1a1a18);border:1px solid color-mix(in srgb,currentColor 28%,transparent)}
.dsh-sc-secondary:hover{background:color-mix(in srgb,currentColor 6%,transparent)}
.dsh-sc-keys{display:inline-flex;align-items:center;gap:2px;opacity:.9;font-size:11px;letter-spacing:.02em}
.dsh-sc-key{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:5px;background:color-mix(in srgb,#fff 18%,transparent);border:1px solid color-mix(in srgb,#fff 28%,transparent);color:inherit}
.dsh-sc-close{position:absolute;top:8px;right:8px;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font:16px/1 inherit;opacity:.7}
.dsh-sc-close:hover,.dsh-sc-close:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}
.dsh-sc-meta{position:absolute;top:10px;right:40px;display:flex;gap:4px;align-items:center}
.dsh-sc-lang{border:0;background:transparent;color:inherit;font:11px inherit;padding:2px 4px;border-radius:4px;cursor:pointer;opacity:.62}
.dsh-sc-lang[aria-pressed="true"]{opacity:1;font-weight:650}
.dsh-sc-error{margin:8px 0 0;color:#b42318;font-size:12px}
.dsh-sc-hint{margin:8px 0 0;font-size:12px;opacity:.78}
`.replace(/\n/g, '')
  document.head.appendChild(style)
}
