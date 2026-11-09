/* 4LPH7 design system bundle: a registry of the components and tokens this system documents.
   Each component's preview is its own preview.html; this script only lists them, so the page can
   show which components exist and which token names they use. Classic script, no imports. */
(function () {
  var components = ["Button", "Card", "Cover", "Eyebrow", "IconButton", "Pager", "Range", "SectionHeading", "StatusChip", "Tabs", "Tag", "Terminal", "TextField", "TextLink"];
  var tokenNames = ["bg", "surface", "surface-raised", "line", "line-strong", "ink", "ink-soft", "ink-dim", "accent", "accent-strong", "accent-deep", "on-accent", "inverse", "on-inverse", "success", "danger", "warning", "pink", "terminal-bg", "terminal-ink", "terminal-dim", "terminal-line", "terminal-accent"];
  window.Lph7 = {
    version: "2026.11.09",
    components: components,
    tokens: tokenNames,
    previewOf: function (name) { return components.indexOf(name) >= 0 ? name + "/preview.html" : null; }
  };
})();
