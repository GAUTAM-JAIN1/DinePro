// Minimal in-memory stand-in for the Firestore Admin SDK, good enough to run
// the transactional service code paths in tests. Transactions buffer writes
// and apply them only if the callback resolves (same contract as Firestore).
// It does NOT simulate concurrency; real race behaviour still needs the
// Firebase emulator (see PHASE_1_NOTES.md).

function makeId() {
  return `id_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function createFakeDb() {
  const store = new Map() // full doc path -> plain object

  const snapOf = (path) => {
    const exists = store.has(path)
    return {
      id: path.split('/').pop(),
      exists,
      ref: docRef(path),
      data: () => (exists ? structuredClone(store.get(path)) : undefined),
    }
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      collection: (name) => colRef(`${path}/${name}`),
      get: async () => snapOf(path),
      set: async (data, opts = {}) => {
        const prev = opts.merge && store.has(path) ? store.get(path) : {}
        store.set(path, structuredClone({ ...prev, ...data }))
      },
      update: async (data) => {
        if (!store.has(path)) throw new Error(`NOT_FOUND ${path}`)
        store.set(path, structuredClone({ ...store.get(path), ...data }))
      },
      delete: async () => {
        store.delete(path)
      },
    }
  }

  function colRef(path) {
    const ref = {
      path,
      doc: (id) => docRef(`${path}/${id ?? makeId()}`),
      add: async (data) => {
        const doc = ref.doc()
        store.set(doc.path, structuredClone(data))
        return doc
      },
      where: (field, op, value) => makeQuery(path, [{ field, op, value }]),
      orderBy: () => makeQuery(path, []),
      limit: () => makeQuery(path, []),
      get: async () => makeQuery(path, []).get(),
    }
    return ref
  }

  function makeQuery(path, filters) {
    const matches = (data) => filters.every(({ field, op, value }) => {
      if (op === '==') return data[field] === value
      if (op === '!=') return data[field] !== value
      if (op === '>=') return data[field] >= value
      if (op === '<') return data[field] < value
      if (op === '>') return data[field] > value
      if (op === '<=') return data[field] <= value
      if (op === 'in') return value.includes(data[field])
      throw new Error(`fake query op not supported: ${op}`)
    })
    const q = {
      isQuery: true,
      where: (field, op, value) => makeQuery(path, [...filters, { field, op, value }]),
      orderBy: () => q,
      limit: () => q,
      get: async () => {
        const docs = []
        for (const [docPath, data] of store) {
          const parent = docPath.slice(0, docPath.lastIndexOf('/'))
          if (parent !== path) continue
          if (!matches(data)) continue
          docs.push({ id: docPath.split('/').pop(), ref: docRef(docPath), data: () => structuredClone(data) })
        }
        return { docs, empty: docs.length === 0 }
      },
    }
    return q
  }

  const db = {
    collection: (name) => colRef(name),
    runTransaction: async (fn) => {
      const writes = []
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, data, opts = {}) => writes.push({ op: 'set', path: ref.path, data, merge: Boolean(opts.merge) }),
        update: (ref, data) => writes.push({ op: 'update', path: ref.path, data }),
        delete: (ref) => writes.push({ op: 'delete', path: ref.path }),
      }
      const result = await fn(tx)
      for (const write of writes) {
        if (write.op === 'set') {
          const prev = write.merge && store.has(write.path) ? store.get(write.path) : {}
          store.set(write.path, structuredClone({ ...prev, ...write.data }))
        } else if (write.op === 'update') {
          if (!store.has(write.path)) throw new Error(`NOT_FOUND ${write.path}`)
          store.set(write.path, structuredClone({ ...store.get(write.path), ...write.data }))
        } else if (write.op === 'delete') {
          store.delete(write.path)
        }
      }
      return result
    },
  }

  return { db, store }
}

module.exports = { createFakeDb }
