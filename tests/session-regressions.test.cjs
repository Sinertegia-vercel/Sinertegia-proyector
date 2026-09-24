const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the real component handlers with deterministic hooks and database replies.
// No production accounts or database writes are used.
function harness(file, initial, replies = [], auth = {}, props = {}) {
  const states = [...initial], refs = [], effects = [], calls = []
  let index = 0, refIndex = 0
  const user = { id: 'user-1', role: 'team', work_start: 9, work_end: 18 }
  const database = {
    async rpc(name, args) {
      calls.push({ rpc: name, args })
      assert.ok(replies.length, 'Unexpected RPC request')
      return replies.shift()
    },
    auth: { signUp: async () => ({ data: { user: { id: user.id } } }), ...auth },
    from(table) {
      const call = { table, operations: [] }
      calls.push(call)
      const builder = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          assert.ok(replies.length, 'Unexpected database request')
          return Promise.resolve(replies.shift()).then(resolve, reject)
        }
        return (...args) => { call.operations.push([key, ...args]); return builder }
      } })
      return builder
    },
  }
  const react = {
    useState(value) {
      const slot = index++
      if (!(slot in states)) states[slot] = value
      return [states[slot], next => { states[slot] = typeof next === 'function' ? next(states[slot]) : next }]
    },
    useRef(value) { const slot = refIndex++; return refs[slot] ||= { current: value } },
    useEffect(effect) { effects.push(effect) },
    useCallback(callback) { return callback },
    createContext() { return { Provider: 'provider' } },
  }
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const exported = {}
  const surface = { addEventListener() {}, removeEventListener() {} }
  const context = {
    exports: exported, console, URLSearchParams,
    window: { ...surface, location: { search: auth.locationSearch || '' }, confirm: auth.confirm || (() => false) }, document: surface,
    setInterval() { return 1 }, clearInterval() {},
    require(id) {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      if (id.endsWith('/supabase')) return { supabase: database }
      if (id.endsWith('/AuthContext')) return { useAuth: () => ({ user, ...auth }) }
      if (id.endsWith('/workSchedule')) return { scheduleForDate: () => ({ enabled: true, start: 9, end: 0 }) }
      return {}
    },
  }
  vm.runInNewContext(code, context)
  return { states, effects, calls, render() {
    index = 0; refIndex = 0; effects.length = 0
    return (exported.default || exported.WorkSessionProvider || exported.AuthProvider)({ children: null, inviteToken: 'invite-1', ...props })
  } }
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate)
    if (found) return found
  }
}

const active = { id: 'session-1', user_id: 'user-1', started_at: new Date().toISOString(), date: 'today' }
const workFile = 'src/contexts/WorkSessionContext.tsx'
for (const [label, replies] of [
  ['read failure', [{ data: null, error: { message: 'offline' } }]],
  ['write failure', [{ data: [active] }, { data: null, error: { message: 'denied' } }]],
]) test(`Checkout preserves session on ${label}`, async () => {
  const h = harness(workFile, [active, false, true, 60], replies)
  assert.equal(await h.render().props.value.checkOut(), false)
  const value = h.render().props.value
  assert.equal(value.currentSession.id, active.id)
  assert.equal(value.elapsedMinutes, 60)
  assert.equal(value.showOvertimeModal, true)
  assert.ok(value.sessionError)
  assert.equal(value.savingSession, false)
})

test('Successful checkout clears session only after persistence', async () => {
  const h = harness(workFile, [active, false, true, 60], [{ data: [active] }, { data: { id: active.id } }])
  assert.equal(await h.render().props.value.checkOut(), true)
  assert.equal(h.render().props.value.currentSession, null)
  assert.equal(h.render().props.value.showOvertimeModal, false)
})

test('Empty session lookup cannot falsely confirm checkout', async () => {
  const h = harness(workFile, [active, false, true, 60], [{ data: [] }, { data: null, error: { message: 'not visible' } }])
  assert.equal(await h.render().props.value.checkOut(), false)
  assert.equal(h.render().props.value.currentSession.id, active.id)
})

for (const file of ['src/components/team/TeamDashboard.tsx', 'src/components/client/ClientPortal.tsx']) {
  test(`${file}: permissions use native Map and individual overrides`, async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let permissions
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'fetchPermissions') permissions = node.getText(ast)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    const icons = ast.statements.find(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'lucide-react').getText(ast)
    const code = ts.transpileModule(`${icons}\n${permissions}\nexports.run = fetchPermissions`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    const exported = {}
    let hidden
    let reads = 0
    const context = {
      exports: exported, require, user: { id: 'u' }, activeTab: 'mistareas', teamView: 'today', embedded: false,
      setHiddenSections(value) { hidden = value }, setActiveTab() {}, setTeamView() {},
      supabase: { from() { return { select() { return { eq() {
        return Promise.resolve({ data: reads++ === 0
          ? [{ section_key: 'chat', allowed: false }, { section_key: 'roadmap', allowed: false }]
          : [{ section_key: 'chat', allowed: true }] })
      } } } } } },
    }
    vm.runInNewContext(code, context)
    await exported.run()
    assert.equal(hidden.has('chat'), false)
    assert.equal(hidden.has('roadmap'), true)
  })
}

test('Check-in does not insert when existing-session lookup fails', async () => {
  const h = harness(workFile, [null, true, false, 0], [{ data: null, error: { message: 'offline' } }])
  await h.render().props.value.checkIn('oficina')
  assert.equal(h.calls.length, 1)
  assert.equal(h.render().props.value.needsCheckIn, true)
  assert.ok(h.render().props.value.sessionError)
})

test('Overtime is shown after scheduled end and acknowledged once per session', () => {
  const h = harness(workFile, [active, false, false, 60])
  h.render(); h.effects[1]()
  assert.equal(h.render().props.value.showOvertimeModal, true)
  h.render().props.value.continueOvertime()
  h.render(); h.effects[1]()
  assert.equal(h.render().props.value.showOvertimeModal, false)
})

for (const kind of ['Team', 'Client']) {
  const invite = { id: 'invite-1', email: 'test@example.invalid', role: 'team', permissions: {}, client: { id: 'client-1' } }
  const form = { full_name: 'Test User', email: invite.email, password: 'password123', confirm: 'password123' }
  const stages = kind === 'Team' ? 2 : 3
  for (let failure = 0; failure < stages; failure++) test(`${kind} registration stops at failed write ${failure + 1}`, async () => {
    const replies = Array.from({ length: failure }, () => ({ data: { id: 'ok' } }))
    replies.push({ data: null, error: { message: 'denied' } })
    const h = harness(`src/components/auth/${kind}RegistrationPage.tsx`, [invite, '', form, false, false, false, false, '', false], replies)
    await find(h.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.equal(h.states[8], false, 'Must not display success')
    assert.ok(h.states[7], 'Must explain the failure')
    assert.equal(h.states[6], false, 'Must release saving state')
    assert.equal(h.calls.length, failure + 1, 'Must stop subsequent writes')
  })
  test(`${kind} registration succeeds when all writes succeed`, async () => {
    const h = harness(`src/components/auth/${kind}RegistrationPage.tsx`, [invite, '', form, false, false, false, false, '', false], Array.from({ length: stages }, () => ({ data: { id: 'ok' } })))
    await find(h.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.equal(h.states[8], true)
  })
}

test('Password success screen can leave recovery mode', () => {
  let finished = false
  const h = harness('src/components/auth/ResetPasswordPage.tsx', ['', '', false, false, false, '', true], [], { finishPasswordRecovery() { finished = true } })
  find(h.render(), node => node.type === 'button').props.onClick()
  assert.equal(finished, true)
})

test('Signup auth events do not interrupt invitation persistence', async () => {
  let onAuthChange
  const session = { user: { id: 'user-1' } }
  const h = harness('src/contexts/AuthContext.tsx', [], [], {
    locationSearch: '?team_invite=invite-1',
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange(callback) { onAuthChange = callback; return { data: { subscription: { unsubscribe() {} } } } },
  })
  h.render(); h.effects[0]()
  await Promise.resolve()
  onAuthChange('SIGNED_IN', session)
  assert.equal(h.calls.length, 0, 'Must not reject a profile still being saved')
  assert.equal(h.render().props.value.user, null, 'Invitation form stays mounted')
  assert.equal(h.render().props.value.loading, false)
})

test('Recovery state clears on continuation and sign-out', async () => {
  let onAuthChange
  const h = harness('src/contexts/AuthContext.tsx', [], [], {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange(callback) { onAuthChange = callback; return { data: { subscription: { unsubscribe() {} } } } },
  })
  h.render(); h.effects[0]()
  await Promise.resolve()
  onAuthChange('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
  assert.equal(h.render().props.value.isPasswordRecovery, true)
  h.render().props.value.finishPasswordRecovery()
  assert.equal(h.render().props.value.isPasswordRecovery, false)
  onAuthChange('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
  onAuthChange('SIGNED_OUT', null)
  assert.equal(h.render().props.value.isPasswordRecovery, false)
})

test('Built-in funnel tasks and stored additions resolve to one canonical list', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/data/projectTemplates.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exported = {}
  vm.runInNewContext(code, { exports: exported, require() { return {} } })
  const vsl = exported.PROJECT_TEMPLATES.find(template => template.id === 'vsl')
  const additions = Array.from({ length: 6 }, (_, index) => ({
    title: `Extra ${index + 1}`, department: 'webmaster', priority: 'alta',
  }))
  const extended = exported.resolveTemplateTasks(vsl, additions, false)
  assert.equal(extended.length, vsl.tasks.length + additions.length)
  assert.equal(exported.resolveTemplateTasks(vsl, additions, true).length, additions.length)
  assert.equal(exported.resolveTemplateTasks(vsl, [vsl.tasks[0]], false).length, vsl.tasks.length)
})

test('Funnel manager and project creation share the canonical task resolver', () => {
  for (const file of [
    'src/components/admin/FunnelTemplatesManager.tsx',
    'src/components/admin/CreateProjectModal.tsx',
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    assert.match(source, /resolveTemplateTasks/)
  }
})

const projectProps = {
  project: { id: 'project-1', name: 'Project example', description: 'Description', status: 'activo' },
  tasks: [], projects: [], teamMembers: [], onBack() {}, onUpdate() {},
}
const projectFile = 'src/components/admin/ProjectDetail.tsx'
function buttonText(node, text) {
  return node.type === 'button' && [node.props.children].flat().includes(text)
}
function openProjectMenu(h) {
  find(h.render(), node => node.props?.['aria-label'] === 'Opciones del proyecto').props.onClick()
}

test('Project actions menu opens the inline editor', () => {
  const h = harness(projectFile, [], [], {}, projectProps)
  openProjectMenu(h)
  find(h.render(), node => buttonText(node, ' Editar proyecto')).props.onClick()
  assert.ok(find(h.render(), node => node.props?.['aria-label'] === 'Nombre del proyecto'))
  assert.ok(find(h.render(), node => node.props?.['aria-label'] === 'Descripción del proyecto'))
})

test('Project deletion uses an application modal and cancel makes no database calls', async () => {
  const h = harness(projectFile, [], [], {}, projectProps)
  openProjectMenu(h)
  find(h.render(), node => buttonText(node, ' Eliminar proyecto')).props.onClick()
  const modal = find(h.render(), node => node.props?.role === 'dialog')
  assert.ok(modal)
  assert.match(JSON.stringify(modal), /Project example/)
  assert.match(JSON.stringify(modal), /no se puede deshacer/)
  find(modal, node => buttonText(node, 'Cancelar')).props.onClick()
  assert.equal(h.calls.length, 0)
  assert.equal(find(h.render(), node => node.props?.role === 'dialog'), undefined)
})

for (const [label, reply, success] of [
  ['success', { data: 'project-1' }, true],
  ['failure', { error: { message: 'denied' } }, false],
  ['missing confirmation', { data: null }, false],
]) test(`Project deletion ${label}`, async () => {
  let navigated = false, refreshed = false
  const h = harness(projectFile, [], [reply], {}, {
    ...projectProps, onBack() { navigated = true }, onUpdate() { refreshed = true },
  })
  openProjectMenu(h)
  find(h.render(), node => buttonText(node, ' Eliminar proyecto')).props.onClick()
  const modal = find(h.render(), node => node.props?.role === 'dialog')
  await find(modal, node => buttonText(node, success ? 'Sí, eliminar proyecto' : 'Sí, eliminar proyecto')).props.onClick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].rpc, 'admin_delete_project')
  assert.equal(h.calls[0].args.p_project_id, 'project-1')
  assert.equal(navigated, success)
  assert.equal(refreshed, success)
  assert.equal(Boolean(find(h.render(), node => node.props?.role === 'alert')), !success)
  assert.equal(Boolean(find(h.render(), node => node.props?.role === 'dialog')), !success)
})

test('Failed project edit stays open and reports the failure', async () => {
  const h = harness(projectFile, [], [{ error: { message: 'denied' } }], {}, projectProps)
  openProjectMenu(h)
  find(h.render(), node => buttonText(node, ' Editar proyecto')).props.onClick()
  await find(h.render(), node => buttonText(node, 'Guardar')).props.onClick()
  assert.ok(find(h.render(), node => node.props?.['aria-label'] === 'Nombre del proyecto'))
  assert.ok(find(h.render(), node => node.props?.role === 'alert'))
})
