/**
 * Client half of the Code review bundle: its configuration card on the
 * Plugins page.
 *
 * tsdown bundles this module into `lib/client.js`: a CJS closure that
 * registers a lazy factory with the browser module table via
 * `window.__ModuleLoader__.load({ id, factory })`. React comes from that
 * table; no Harness Client package is loaded as a module. The card reads and
 * writes the `code-review` settings namespace through `ctx.configForms` and
 * registers into the Plugins page's `plugins.bundle.config` and
 * `plugins.row.config` slots only while the Host serves that namespace.
 * @module @local/dsh-code-review/client
 */

import * as React from 'react'

const h = React.createElement

/** Locale namespace owned by this page. */
const NS = 'settings.codeReview'
/** Loader entry id whose volatile Config fields this card edits. */
const ENTRY_NS = 'code-review'
/** The bundle's own configuration card on its package page. */
const PACKAGE_KEY = '@local/dsh-code-review'
/** The same form on the `code-review` row's page, keyed as `<package name>#<row id>`. */
const ROW_KEY = `${PACKAGE_KEY}#code-review`

/** English copy. */
const en = {
  summary: 'Review language, finding limit, and context budgets.',
  reportTitle: 'Report',
  contextTitle: 'Review context',
  language: 'Report language',
  languageHint: 'Language of the review report. Auto follows the interface language.',
  languageAuto: 'Auto (follow the interface)',
  maxFindings: 'Maximum findings',
  maxFindingsHint: 'Most findings the reviewer may report, ranked by severity.',
  maxFiles: 'Changed files per review',
  maxFilesHint: 'Files fetched into the review context. A larger pull request is truncated.',
  maxPatchBytes: 'Patch size per file',
  maxPatchBytesHint: 'Bytes of diff kept per file. 262144 bytes = 256 KiB.',
  retentionDays: 'Keep prepared contexts',
  retentionDaysHint: 'Days before prepared review context directories are removed; 0 keeps all.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  undoReset: 'Undo reset',
  readOnly: 'This deployment stores plugin settings read-only.',
  unavailable: 'Code review settings are unavailable while the plugin is not loaded.',
  loading: 'Loading settings…',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  saved: 'Saved',
  discard: 'Discard',
  invalidRange: 'Enter a whole number between {min} and {max}, or leave blank to use the default.',
  blankHint: 'Leave a number field blank to use the default.',
}

/** Simplified Chinese copy. */
const zh = {
  summary: '设置审查报告语言、问题数量和上下文预算。',
  reportTitle: '报告',
  contextTitle: '审查上下文',
  language: '报告语言',
  languageHint: '审查报告使用的语言；自动跟随界面语言。',
  languageAuto: '自动（跟随界面）',
  maxFindings: '最多问题数',
  maxFindingsHint: '审查者最多报告的问题数量，按严重程度排序。',
  maxFiles: '每次审查的文件数',
  maxFilesHint: '抓取到审查上下文中的文件数；超出部分会被截断。',
  maxPatchBytes: '单文件补丁大小',
  maxPatchBytesHint: '每个文件保留的 diff 字节数；262144 字节 = 256 KiB。',
  retentionDays: '保留已准备上下文',
  retentionDaysHint: '审查上下文目录保留天数；0 表示一直保留。',
  overridden: '已覆盖',
  reset: '恢复默认',
  undoReset: '撤销恢复',
  readOnly: '本部署的插件设置为只读。',
  unavailable: '插件未加载时无法配置代码审查设置。',
  loading: '正在加载设置…',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  saved: '已保存',
  discard: '放弃修改',
  invalidRange: '请输入 {min} 到 {max} 之间的整数；留空表示使用默认值。',
  blankHint: '数字字段留空表示使用默认值。',
}

/**
 * The fields this card edits, in page order. Each names a volatile Config
 * field; every write goes through the settings namespace, not localStorage.
 */
const FIELDS = [
  { key: 'language', kind: 'select', section: 'report', label: 'language', hint: 'languageHint' },
  { key: 'maxFindings', kind: 'int', section: 'report', label: 'maxFindings', hint: 'maxFindingsHint', min: 1, max: 100 },
  { key: 'maxFiles', kind: 'int', section: 'context', label: 'maxFiles', hint: 'maxFilesHint', min: 1, max: 2000 },
  { key: 'maxPatchBytes', kind: 'int', section: 'context', label: 'maxPatchBytes', hint: 'maxPatchBytesHint', min: 1024, max: 16 * 1024 * 1024 },
  { key: 'retentionDays', kind: 'int', section: 'context', label: 'retentionDays', hint: 'retentionDaysHint', min: 0, max: 365 },
]

/** Language choices, in display order. */
const LANGUAGES = [
  { value: 'auto', label: 'languageAuto' },
  { value: 'zh', label: null, text: '简体中文' },
  { value: 'en', label: null, text: 'English' },
]

const SECTIONS = [
  { id: 'report', title: 'reportTitle' },
  { id: 'context', title: 'contextTitle' },
]

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Render a stored value as input text. */
function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/** The value a field shows once its override is removed. */
function inherited(value, base, key) {
  const fallback = isRecord(base) ? base[key] : undefined
  return fallback === undefined ? value[key] : fallback
}

/** Parsed value for one draft, or undefined for an empty field (meaning reset). */
function parse(field, text) {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  return field.kind === 'int' ? Number(trimmed) : trimmed
}

/** The form body. Hooks run unconditionally, including for the summary view. */
function Card(props) {
  const t = props.t
  const [draft, setDraft] = React.useState({})
  const [resets, setResets] = React.useState({})
  const [touched, setTouched] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [notice, setNotice] = React.useState(null)
  const snapshot = React.useSyncExternalStore(props.subscribe, props.getSnapshot)
  const id = React.useId()

  React.useEffect(() => {
    if (notice !== 'saved') return undefined
    const timer = setTimeout(() => { setNotice(null) }, 2000)
    return () => { clearTimeout(timer) }
  }, [notice])

  if (props.view === 'summary') return t('summary')
  if (snapshot.status === 'unavailable') return renderNote(t('unavailable'))
  if (snapshot.status === 'loading' || snapshot.value === undefined) return renderNote(t('loading'))

  const value = isRecord(snapshot.value) ? snapshot.value : {}
  const base = isRecord(snapshot.base) ? snapshot.base : {}
  const user = isRecord(snapshot.user) ? snapshot.user : {}
  const writable = snapshot.writable === true
  const disabled = !writable || saving

  /** Text shown for one field, including staged edits and staged resets. */
  const textOf = (field) => {
    if (hasOwn(draft, field.key)) return draft[field.key]
    if (resets[field.key]) return toText(inherited(value, base, field.key))
    return toText(value[field.key])
  }
  /** Whether this field carries a user layer that Reset would remove. */
  const overridden = field => hasOwn(user, field.key) && !resets[field.key]
  /** Whether saving would write anything for this field. */
  const pending = (field) => {
    if (resets[field.key]) return hasOwn(user, field.key)
    if (!hasOwn(draft, field.key)) return false
    // Compare the staged text, not only the parsed value: "015" and
    // "15.0" parse equal but still need Save to normalize the field.
    return draft[field.key] !== toText(value[field.key])
  }

  const dirty = FIELDS.some(pending)

  /** Validation message per field; empty fields mean "use the default". */
  const validation = {}
  for (const field of FIELDS) {
    if (field.kind !== 'int') continue
    const text = textOf(field).trim()
    if (text === '') continue
    const number = Number(text)
    if (!Number.isInteger(number) || number < field.min || number > field.max) {
      validation[field.key] = t('invalidRange', { min: field.min, max: field.max })
    }
  }

  const invalid = Object.keys(validation).length > 0

  const edit = (field, next) => {
    setNotice(null)
    setDraft({ ...draft, [field.key]: next })
    if (resets[field.key]) {
      const nextResets = { ...resets }
      delete nextResets[field.key]
      setResets(nextResets)
    }
  }

  const toggleReset = (field) => {
    setNotice(null)
    if (resets[field.key]) {
      const nextResets = { ...resets }
      delete nextResets[field.key]
      setResets(nextResets)
      return
    }
    const nextResets = { ...resets, [field.key]: true }
    setResets(nextResets)
    if (hasOwn(draft, field.key)) {
      const nextDraft = { ...draft }
      delete nextDraft[field.key]
      setDraft(nextDraft)
    }
  }

  const discard = () => {
    setDraft({})
    setResets({})
    setTouched(false)
    setNotice(null)
  }

  const save = async () => {
    setTouched(true)
    if (!writable || saving) return
    if (invalid) return
    const ops = []
    for (const field of FIELDS) {
      const clearsOverride = resets[field.key] || (hasOwn(draft, field.key) && draft[field.key].trim() === '')
      if (clearsOverride) {
        if (hasOwn(user, field.key)) ops.push({ op: 'unset', path: [field.key] })
        continue
      }
      if (!hasOwn(draft, field.key)) continue
      const next = parse(field, draft[field.key])
      if (next === undefined || next === value[field.key]) continue
      ops.push({ op: 'set', path: [field.key], value: next })
    }
    if (ops.length === 0) {
      setDraft({})
      setResets({})
      setTouched(false)
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      const accepted = await props.mutate(ops, snapshot.revision)
      if (accepted) {
        setDraft({})
        setResets({})
        setTouched(false)
        setNotice('saved')
      } else {
        setNotice('saveFailed')
      }
    } catch (_error) {
      setNotice('saveFailed')
    } finally {
      setSaving(false)
    }
  }

  const renderField = (field) => {
    const inputId = `${id}-${field.key}`
    const hintId = `${inputId}-hint`
    const errorId = `${inputId}-error`
    const error = validation[field.key] === undefined || (!touched && !hasOwn(draft, field.key))
      ? undefined
      : validation[field.key]
    const canReset = overridden(field) || resets[field.key] || hasOwn(draft, field.key)
    const control = field.kind === 'select'
      ? h('select', {
        id: inputId, className: 'cr-input', value: textOf(field), disabled,
        'aria-describedby': hintId, onChange: event => { edit(field, event.target.value) },
      }, LANGUAGES.map(option => h('option', {
        key: option.value, value: option.value,
      }, option.label === null ? option.text : t(option.label))))
      : h('input', {
        id: inputId, className: 'cr-input', type: 'text', inputMode: 'numeric', autoComplete: 'off',
        value: textOf(field),
        disabled, 'aria-invalid': error === undefined ? undefined : 'true',
        'aria-describedby': error === undefined ? hintId : `${hintId} ${errorId}`,
        onChange: event => { edit(field, event.target.value) },
      })
    return h('div', { className: 'cr-field', key: field.key, 'data-cr-field': field.key },
      h('div', { className: 'cr-field-head' },
        h('label', { className: 'cr-label', htmlFor: inputId }, t(field.label)),
        h('div', { className: 'cr-field-meta' },
          overridden(field) ? h('span', { className: 'cr-badge' }, t('overridden')) : null,
          canReset
            ? h('button', {
              type: 'button', className: 'cr-link', disabled,
              onClick: () => { toggleReset(field) },
            }, t(resets[field.key] ? 'undoReset' : 'reset'))
            : null)),
      control,
      h('p', { className: 'cr-hint', id: hintId }, t(field.hint)),
      error === undefined ? null : h('p', { className: 'cr-error', id: errorId, role: 'alert' }, error))
  }

  return h('div', {
    className: 'cr-settings', 'data-cr-settings': '', 'aria-busy': saving ? 'true' : undefined,
  },
    h('style', null, CSS),
    writable ? null : h('p', { className: 'cr-note', role: 'status' }, t('readOnly')),
    SECTIONS.map(section => h('section', {
      className: 'cr-section', key: section.id, 'aria-labelledby': `${id}-${section.id}-title`,
    },
    h('h4', { className: 'cr-section-title', id: `${id}-${section.id}-title` }, t(section.title)),
    FIELDS.filter(field => field.section === section.id).map(renderField))),
    h('p', { className: 'cr-note', 'data-cr-blank': '' }, t('blankHint')),
    h('div', { className: 'cr-actions' },
      h('button', {
        type: 'button', className: 'cr-button cr-primary', 'data-cr-save': '',
        disabled: !dirty || disabled || invalid, onClick: () => { void save() },
      }, saving ? t('saving') : t('save')),
      h('button', {
        type: 'button', className: 'cr-button', 'data-cr-discard': '',
        disabled: saving || !dirty, onClick: discard,
      }, t('discard')),
      h('p', {
        className: notice === 'saveFailed' ? 'cr-status cr-status-error' : 'cr-status',
        role: 'status', 'data-cr-status': notice === null ? '' : notice,
      }, notice === 'saved' ? t('saved') : notice === 'saveFailed' ? t('saveFailed') : '')))
}

/** One muted paragraph for the loading/unavailable states. */
function renderNote(text) {
  return h('div', { className: 'cr-settings' }, h('style', null, CSS), h('p', { className: 'cr-note', role: 'status' }, text))
}

/**
 * Self-contained styles, mirroring the host's SettingsValueField and
 * SettingsForm controls. Every colour, radius, and focus value is a page
 * theme token; the focus-ring fallback is the host's own.
 */
const CSS = [
  '.cr-settings{display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}',
  '.cr-note{margin:0 0 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}',
  '.cr-note[data-cr-blank]{margin:12px 0 0}',
  '.cr-section{display:flex;flex-direction:column}',
  '.cr-section-title{margin:0;padding:12px 0 0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}',
  '.cr-field{display:flex;flex-direction:column;gap:6px;max-width:560px;padding:12px 0}',
  '.cr-field+.cr-field{border-top:.5px solid var(--dsw-alias-border-l2)}',
  '.cr-field-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.cr-field-meta{display:inline-flex;align-items:center;gap:8px;margin-left:auto}',
  '.cr-label{flex:0 1 auto;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
  '.cr-badge{padding:0 6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}',
  '.cr-link{padding:0;border:none;background:none;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}',
  '.cr-link:hover:not(:disabled){color:var(--dsw-alias-label-primary)}',
  '.cr-link:disabled{cursor:default;opacity:.6}',
  '.cr-link:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:2px}',
  '.cr-input{box-sizing:border-box;width:100%;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
  '.cr-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}',
  '.cr-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
  '.cr-input[aria-invalid="true"]{border-color:var(--dsw-alias-state-error-primary)}',
  '.cr-input[aria-invalid="true"]:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:1px}',
  '.cr-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
  '.cr-error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
  '.cr-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:16px}',
  '.cr-button{appearance:none;padding:5px 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1.5;cursor:pointer}',
  '.cr-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
  '.cr-button:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:1px}',
  '.cr-button:disabled{opacity:.4;cursor:default}',
  '.cr-primary{border-color:transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
  '.cr-status{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
  '.cr-status-error{color:var(--dsw-alias-state-error-primary)}',
  '@media (prefers-reduced-motion:no-preference){.cr-link,.cr-button{transition:background-color .12s ease,color .12s ease,opacity .12s ease}}',
].join('')

export const inject = ['slots', 'locale', 'configForms']

export function apply(ctx) {
  // Older Web clients may compose the settings service without the
  // served-namespace watch; the command and tool still work there, so
  // skip the card instead of failing the plugin entry.
  if (typeof ctx.configForms.whileServed !== 'function') return
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'code-review: dictionaries')
  const form = ctx.configForms.get(ENTRY_NS)
  ctx.effect(() => () => { void form.dispose() }, 'code-review: settings form')
  const face = {
    subscribe: listener => form.subscribe(listener),
    getSnapshot: () => form.getSnapshot(),
    mutate: (ops, revision) => form.mutate(ops, revision),
  }
  ctx.effect(() => ctx.configForms.whileServed([ENTRY_NS], () => {
    const disposers = [
      // The package page shows the card directly; the row page keeps a
      // focused entry for the one row this bundle declares.
      ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config', key: PACKAGE_KEY, locale: NS, inject: () => face,
      }, Card)),
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config', key: ROW_KEY, locale: NS, inject: () => face,
      }, Card)),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }), 'code-review: settings card')
}
