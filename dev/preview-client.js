// Adapter for the real DSH client plugin; data comes only from the preview server.
window.__ModuleLoader__ = {
  load(spec) {
    const React = window.__previewModules.react
    const plugin = spec.factory((name) => window.__previewModules[name])
    let dictionary = {}
    const tr = (key, args = {}) => String(dictionary[key] || key).replace(/\{(\w+)\}/g, (_, name) => args[name] ?? `{${name}}`)
    const ctx = {
      effect(callback) { callback() },
      locale: { register(_ns, dict) { dictionary = dict.zh }, bind() { return tr } },
      get() { return null },
      slots: {
        inject(_slot, callback) { callback() },
        register(specification, component) {
          if (specification.name !== 'main') return
          const props = specification.inject()
          window.__previewModules['react-dom/client'].createRoot(document.getElementById('root')).render(React.createElement(component, props))
        },
      },
    }
    plugin.apply(ctx)
  },
}
