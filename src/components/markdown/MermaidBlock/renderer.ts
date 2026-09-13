import mermaid from "mermaid";

// Mermaid keeps configuration and a temporary DOM globally. Serialize the
// entire initialize/render/cleanup cycle, including renders from open dialogs.
let queue: Promise<unknown> = Promise.resolve();
let nextId = 0;

export function renderMermaid(source: string, isCurrent: () => boolean) {
  const work = queue.then(async () => {
    await document.fonts.ready;
    if (!isCurrent()) return null;
    const tokens = getComputedStyle(document.documentElement);
    const color = (name: string) => tokens.getPropertyValue(name).trim();
    const fontFamily = getComputedStyle(document.body).fontFamily;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      maxTextSize: 50_000,
      maxEdges: 500,
      theme: "base",
      look: "classic",
      layout: "dagre",
      htmlLabels: false,
      fontFamily,
      secure: [
        "secure", "securityLevel", "startOnLoad", "maxTextSize", "maxEdges",
        "suppressErrorRendering", "theme", "themeVariables", "fontFamily", "htmlLabels", "look", "layout",
      ],
      themeVariables: {
        darkMode: document.documentElement.classList.contains("dark"),
        background: color("--background"),
        primaryColor: color("--surface"),
        primaryTextColor: color("--foreground"),
        primaryBorderColor: color("--border"),
        secondaryColor: color("--surface"),
        secondaryTextColor: color("--foreground"),
        secondaryBorderColor: color("--border"),
        tertiaryColor: color("--background"),
        tertiaryTextColor: color("--foreground"),
        tertiaryBorderColor: color("--border"),
        lineColor: color("--muted"),
        textColor: color("--foreground"),
        mainBkg: color("--surface"),
        nodeBorder: color("--border"),
        clusterBkg: color("--background"),
        clusterBorder: color("--border"),
        edgeLabelBackground: color("--background"),
        actorBkg: color("--surface"),
        actorBorder: color("--border"),
        actorTextColor: color("--foreground"),
        actorLineColor: color("--muted"),
        signalColor: color("--muted"),
        signalTextColor: color("--foreground"),
        noteBkgColor: color("--surface"),
        noteTextColor: color("--foreground"),
        noteBorderColor: color("--border"),
        fontFamily,
        fontSize: "16px",
      },
    });

    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText = "position:fixed;left:-100000px;top:0;width:1200px;pointer-events:none";
    document.body.append(container);
    try {
      const { svg } = await mermaid.render(`markdown-mermaid-${++nextId}`, source, container);
      return isCurrent() ? svg : null;
    } finally {
      container.remove();
    }
  });
  queue = work.catch(() => undefined);
  return work;
}
