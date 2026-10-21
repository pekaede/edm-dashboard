// 当前沙箱禁止 npm 联网和 Chromium 的 setsockopt，无法使用 jsdom/happy-dom/浏览器。
// 这里只实现 React DOM 挂载需要的宿主接口；createRoot、act、hooks、effects、Context
// 都使用真实 React。EventTarget/Event 使用 Node 原生实现，History 只模拟 URL 写入。
// 不验证布局、滚动恢复、浏览器原生 back/forward 或真实用户事件合成；导航测试显式派发事件。
// 此宿主不含任何业务筛选、缓存、刷新或 URL 解析逻辑。
import { act } from "react";

class HostNode extends EventTarget {
  constructor(nodeType, name, document) {
    super();
    this.nodeType = nodeType;
    this.nodeName = name;
    this.ownerDocument = document;
    this.parentNode = null;
    this.childNodes = [];
  }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  appendChild(node) {
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, before) {
    if (before === null) return this.appendChild(node);
    node.parentNode?.removeChild(node);
    const index = this.childNodes.indexOf(before);
    if (index < 0) throw new Error("insertBefore: reference node missing");
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index < 0) throw new Error("removeChild: node missing");
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    if (value !== "") this.appendChild(this.ownerDocument.createTextNode(String(value)));
  }
  contains(node) { return node === this || this.childNodes.some((child) => child.contains(node)); }
}

class HostElement extends HostNode {
  constructor(name, document) {
    super(1, name.toUpperCase(), document);
    this.tagName = this.nodeName;
    this.namespaceURI = "http://www.w3.org/1999/xhtml";
    this.attributes = new Map();
    this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttributeNS(_namespace, name, value) { this.setAttribute(name, value); }
  removeAttributeNS(_namespace, name) { this.removeAttribute(name); }
  focus() { this.ownerDocument.activeElement = this; }
}

class HostText extends HostNode {
  constructor(value, document) { super(3, "#text", document); this.nodeValue = value; }
  get textContent() { return this.nodeValue; }
  set textContent(value) { this.nodeValue = value; }
}

export function descendants(node, predicate) {
  return node.childNodes.flatMap((child) => [
    ...(child.nodeType === 1 && predicate(child) ? [child] : []),
    ...descendants(child, predicate),
  ]);
}

export async function mountDOM(t, hash = "") {
  const document = new HostNode(9, "#document", null);
  document.ownerDocument = document;
  document.createElement = (name) => new HostElement(name, document);
  document.createElementNS = (namespace, name) => {
    const element = document.createElement(name);
    element.namespaceURI = namespace;
    return element;
  };
  document.createTextNode = (value) => new HostText(value, document);
  document.documentElement = document.appendChild(document.createElement("html"));
  document.body = document.documentElement.appendChild(document.createElement("body"));
  document.activeElement = document.body;
  document.visibilityState = "visible";
  document.querySelector = () => null;
  const window = new EventTarget();
  window.document = document;
  window.location = new URL(`https://edm.test/${hash}`);
  window.history = {
    pushState(_state, _title, url) { window.location = new URL(url, window.location); },
    replaceState(_state, _title, url) { window.location = new URL(url, window.location); },
  };
  window.HTMLElement = HostElement;
  window.HTMLIFrameElement = class extends HostElement {};
  window.scrollTo = () => {};
  window.matchMedia = () => ({ matches: true });
  window.navigator = { onLine: true, userAgent: "node-mounted-tests" };
  document.defaultView = window;
  const storage = new Map();
  const sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const bindings = {
    window, document, navigator: window.navigator, sessionStorage,
    HTMLElement: HostElement, Node: HostNode, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(bindings).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(bindings)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  let root;
  t.after(async () => {
    try { if (root) await act(() => root.unmount()); }
    finally {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
  const { createRoot } = await import("react-dom/client");
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  return { root, container, window, document, render: (element) => act(() => root.render(element)) };
}
