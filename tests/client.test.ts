import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

/**
 * A tiny React stand-in: enough hook state to re-render synchronously after a
 * state update, so the card's staging, validation, and save operations can be
 * exercised without a browser or a DOM.
 */
interface Element {
  type: unknown
  props: Record<string, any>
  children: unknown[]
}

interface ActiveRuntime {
  index: number
  states: unknown[]
  rerender: () => void
}

const source = await fs.readFile(new URL('../../client.js', import.meta.url), 'utf8')
let activeRuntime: ActiveRuntime | undefined

const reactStandIn = {
  createElement: (type: unknown, elementProps: Record<string, unknown> | null, ...children: unknown[]): Element => ({
    type, props: elementProps ?? {}, children,
  }),
  useState: (initial: unknown) => {
    const runtime = activeRuntime
    assert.ok(runtime, 'a render is active')
    const index = runtime.index++
    if (!(index in runtime.states)) {
      runtime.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    }
    return [runtime.states[index], (next: unknown) => {
      runtime.states[index] = typeof next === 'function'
        ? (next as (previous: unknown) => unknown)(runtime.states[index])
        : next
      runtime.rerender()
    }]
  },
  useSyncExternalStore: (_subscribe: () => () => void, getSnapshot: () => unknown) => getSnapshot(),
  useEffect: () => {},
  useId: () => 'cr',
}

/** Read the client module and capture the factory it registers. */
function loadClient() {
  let definition: { id: string; factory: (require: (id: string) => unknown) => any } | undefined
  const context = {
    window: { __ModuleLoader__: { load: (next: typeof definition) => { definition = next } } },
    console,
    setTimeout,
    clearTimeout,
  }
  vm.runInNewContext(source, context, { filename: 'client.js' })
  assert.ok(definition, 'the client module registers a factory')
  return definition
}

function flatten(nodes: unknown[], out: Element[] = []): Element[] {
  for (const node of nodes) {
    if (Array.isArray(node)) flatten(node, out)
    else if (node !== null && typeof node === 'object' && 'type' in node && 'props' in node) {
      const element = node as Element
      out.push(element)
      flatten(element.children, out)
    }
  }
  return out
}

function elements(tree: unknown): Element[] {
  return flatten([tree])
}

function find(tree: unknown, predicate: (element: Element) => boolean): Element {
  const match = elements(tree).find(predicate)
  assert.ok(match, 'expected element was rendered')
  return match
}

function text(tree: unknown): string {
  if (tree === null || tree === undefined || typeof tree === 'boolean') return ''
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map(text).join('')
  if (typeof tree === 'object' && 'children' in tree) return (tree as Element).children.map(text).join('')
  return ''
}

function readySnapshot(overrides: Record<string, unknown> = {}) {
  const defaults = { language: 'auto', maxFindings: 15, maxFiles: 200, maxPatchBytes: 262144, retentionDays: 7 }
  return {
    status: 'ready',
    value: { ...defaults, ...overrides },
    base: { ...defaults },
    user: {},
    revision: 3,
    writable: true,
  }
}

/** Apply the client module with a fake page context and return what it registered. */
function createHarness(snapshot: Record<string, unknown>) {
  const mutateCalls: { ops: readonly unknown[]; revision?: number }[] = []
  const form = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    mutate: async (ops: readonly unknown[], revision?: number) => {
      mutateCalls.push({ ops, revision })
      return true
    },
    dispose: async () => {},
  }
  const registrations: { name: string; options: Record<string, any>; component: (props: any) => unknown }[] = []
  const slotNames: string[] = []
  const ctx = {
    effect: (fn: () => unknown) => fn(),
    locale: {
      register: () => () => {},
      bind: () => (key: string, params?: Record<string, unknown>) =>
        params === undefined ? key : `${key}(${JSON.stringify(params)})`,
    },
    configForms: {
      get: (namespace: string) => {
        assert.equal(namespace, 'code-review')
        return form
      },
      whileServed: (namespaces: readonly string[], register: () => () => void) => {
        assert.deepEqual([...namespaces], ['code-review'])
        return register()
      },
    },
    slots: {
      inject: (name: string, register: () => () => void) => {
        slotNames.push(name)
        return register()
      },
      register: (registered: Record<string, any>, component: (props: any) => unknown) => {
        registrations.push({ name: registered.name, options: registered, component })
        return () => {}
      },
    },
  }
  const module = loadClient().factory(id => {
    assert.equal(id, 'react')
    return reactStandIn
  })
  module.apply(ctx)
  assert.equal(registrations.length, 2, 'apply registers the package and row cards')
  return {
    module, form, mutateCalls, slotNames, registrations,
    card: registrations[0]?.component as (props: any) => unknown,
    options: registrations[0]?.options as Record<string, any>,
  }
}

/** Render once and return the current tree; state setters rerender in place. */
function render(card: (props: any) => unknown, props: Record<string, any>) {
  const states: unknown[] = []
  let tree: unknown
  const renderOnce = (): void => {
    const runtime = { index: 0, states, rerender: renderOnce }
    activeRuntime = runtime
    tree = card(props)
  }
  renderOnce()
  return { tree: () => tree, rerender: renderOnce }
}

function pageProps(harness: ReturnType<typeof createHarness>, t: (key: string, params?: Record<string, unknown>) => string) {
  return { view: 'page', t, ...harness.options.inject() }
}

test('the client module registers the package and row settings cards for the code-review namespace', () => {
  const harness = createHarness(readySnapshot())
  assert.equal(harness.module.inject.length, 3)
  assert.ok(harness.module.inject.includes('configForms'))
  assert.deepEqual(harness.slotNames, ['plugins.bundle.config', 'plugins.row.config'])
  assert.deepEqual(harness.registrations.map(entry => entry.name), ['plugins.bundle.config', 'plugins.row.config'])
  assert.equal(harness.registrations[0]?.options.key, '@local/dsh-code-review')
  assert.equal(harness.registrations[1]?.options.key, '@local/dsh-code-review#code-review')
  for (const entry of harness.registrations) {
    assert.equal(entry.options.locale, 'settings.codeReview')
    assert.equal(typeof entry.options.inject(), 'object')
  }
})

test('the summary view is one localized line', () => {
  const harness = createHarness(readySnapshot())
  const runtime = render(harness.card, { view: 'summary', t: (key: string) => key, ...harness.options.inject() })
  assert.equal(runtime.tree(), 'summary')
})

test('the page renders the five exposed fields', () => {
  const harness = createHarness(readySnapshot())
  const runtime = render(harness.card, pageProps(harness, key => key))
  const fields = elements(runtime.tree()).filter(element => element.props['data-cr-field'] !== undefined)
  assert.deepEqual(fields.map(field => field.props['data-cr-field']), [
    'language', 'maxFindings', 'maxFiles', 'maxPatchBytes', 'retentionDays',
  ])
  const labels = text(runtime.tree())
  assert.match(labels, /maxFindingsHint/)
  assert.match(labels, /languageAuto/)
  assert.match(labels, /reportTitle/)
  assert.match(labels, /contextTitle/)
})

test('saving a dirty number sends one path write and reports success', async () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params === undefined ? key : `${key}${JSON.stringify(params)}`
  const harness = createHarness(readySnapshot())
  const runtime = render(harness.card, pageProps(harness, t))

  const save = () => find(runtime.tree(), element => element.props['data-cr-save'] !== undefined)
  assert.equal(save().props.disabled, true, 'save starts disabled while clean')

  const maxFindings = find(runtime.tree(), element => element.props['data-cr-field'] === 'maxFindings')
  find(maxFindings, element => element.type === 'input').props.onChange({ target: { value: '25' } })

  assert.equal(save().props.disabled, false, 'save enables for a staged change')
  save().props.onClick()
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.equal(JSON.stringify(harness.mutateCalls), JSON.stringify([{ ops: [{ op: 'set', path: ['maxFindings'], value: 25 }], revision: 3 }]))
  const status = find(runtime.tree(), element => element.props['data-cr-status'] !== undefined)
  assert.equal(status.props['data-cr-status'], 'saved')
})

test('typed text is validated instead of being read as an empty number input', async () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params === undefined ? key : `${key}${JSON.stringify(params)}`
  const harness = createHarness(readySnapshot())
  const runtime = render(harness.card, pageProps(harness, t))

  const maxFindings = find(runtime.tree(), element => element.props['data-cr-field'] === 'maxFindings')
  const input = find(maxFindings, element => element.type === 'input')
  assert.equal(input.props.type, 'text', 'the field accepts raw text so a typo is validated, not sanitized to empty')
  input.props.onChange({ target: { value: 'not a number' } })

  const save = find(runtime.tree(), element => element.props['data-cr-save'] !== undefined)
  assert.equal(save.props.disabled, true, 'save is disabled while a staged value is invalid')
  save.props.onClick()
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.deepEqual(harness.mutateCalls, [])
  const error = find(runtime.tree(), element => element.props.className === 'cr-error')
  assert.match(text(error), /invalidRange/)
})

test('equivalent numeric text keeps Save enabled and normalizes the field', async () => {
  const harness = createHarness(readySnapshot())
  const runtime = render(harness.card, pageProps(harness, key => key))
  const maxFindings = find(runtime.tree(), element => element.props['data-cr-field'] === 'maxFindings')
  find(maxFindings, element => element.type === 'input').props.onChange({ target: { value: '015' } })

  const save = find(runtime.tree(), element => element.props['data-cr-save'] !== undefined)
  assert.equal(save.props.disabled, false, 'text that differs from the stored value is still a pending edit')
  save.props.onClick()
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.deepEqual(harness.mutateCalls, [], 'no write is needed for a value that parses equal')
  const input = find(
    find(runtime.tree(), element => element.props['data-cr-field'] === 'maxFindings'),
    element => element.type === 'input',
  )
  assert.equal(input.props.value, '15', 'the field falls back to the canonical value')
})

test('resetting an overridden field unsets it on save', async () => {
  const snapshot = readySnapshot({ maxFiles: 50 })
  snapshot.user = { maxFiles: 50 }
  const harness = createHarness(snapshot)
  const runtime = render(harness.card, pageProps(harness, key => key))

  const maxFiles = find(runtime.tree(), element => element.props['data-cr-field'] === 'maxFiles')
  find(maxFiles, element => element.props.className === 'cr-link').props.onClick()

  const input = find(
    find(runtime.tree(), element => element.props['data-cr-field'] === 'maxFiles'),
    element => element.type === 'input',
  )
  assert.equal(input.props.value, '200', 'the reset previews the inherited value')

  find(runtime.tree(), element => element.props['data-cr-save'] !== undefined).props.onClick()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(JSON.stringify(harness.mutateCalls), JSON.stringify([{ ops: [{ op: 'unset', path: ['maxFiles'] }], revision: 3 }]))
})

test('unavailable settings render the localized note instead of a form', () => {
  const snapshot = { status: 'unavailable', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false }
  const harness = createHarness(snapshot)
  const runtime = render(harness.card, pageProps(harness, key => key))
  assert.equal(elements(runtime.tree()).filter(element => element.props['data-cr-field'] !== undefined).length, 0)
  assert.match(text(runtime.tree()), /unavailable/)
})
