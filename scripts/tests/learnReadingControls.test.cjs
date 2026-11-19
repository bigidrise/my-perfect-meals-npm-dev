const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const source = fs.readFileSync("client/src/pages/Learn.tsx", "utf8");
const ast = ts.createSourceFile("Learn.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
function visit(n) { nodes.push(n); ts.forEachChild(n,visit); }
visit(ast);
const libraryItem = nodes.find(n=>ts.isFunctionDeclaration(n) && n.name?.text==="LibraryItem");
const within = n => n.pos>=libraryItem.pos && n.end<=libraryItem.end;
const text = n => n.getText(ast).replace(/\s+/g," ");
const buttons = nodes.filter(n=>within(n) && ts.isJsxElement(n) && n.openingElement.tagName.getText(ast)==="PillButton");
const controls = ["Read","Listen"].map(label=>buttons.find(n=>n.children.some(c=>ts.isJsxText(c)&&c.text.trim()===label)));

test("every educational card retains Read and Listen inside the same hidden control group",()=>{
  assert.ok(libraryItem);
  assert.ok(controls.every(Boolean));
  assert.equal(controls[0].parent,controls[1].parent);
  const parent=controls[0].parent;
  assert.equal(parent.openingElement.tagName.getText(ast),"div");
  const attrs=parent.openingElement.attributes.properties;
  assert.ok(attrs.some(a=>a.name?.getText(ast)==="hidden" && !a.initializer));
  assert.match(text(parent.openingElement),/style=\{\{ display: "none" \}\}/);
  // Only the controls are hidden, never the card or its educational body.
  assert.equal(parent.children.filter(ts.isJsxElement).length,2);
});

test("handlers, reading default, expansion, narration and full educational data are preserved",()=>{
  assert.match(text(controls[0]),/handleModeChange\("read"\)/);
  assert.match(text(controls[1]),/handleModeChange\("listen"\)/);
  assert.match(text(libraryItem),/useState<"read" \| "listen">\("read"\)/);
  assert.match(text(libraryItem),/useNarration\(topic.content.sections\)/);
  assert.match(text(libraryItem),/onClick=\{handleToggle\}/);
  assert.match(text(libraryItem),/topic.content.sections.map/);
  for (const field of ["section.heading", "section.text", "section.list"]) {
    assert.ok(text(libraryItem).includes(field));
  }
});

test("the actual expanded card renders its text while both retained controls are hidden",()=>{
  const React=require("react");
  const {renderToStaticMarkup}=require("react-dom/server");
  const vm=require("node:vm");
  const noop=()=>{};
  const dom=tag=>({children,initial,animate,exit,transition,active,...props})=>React.createElement(tag,props,children);
  const context={
    module:{exports:{}}, React,
    useMemo:React.useMemo,useState:React.useState,useCallback:React.useCallback,useEffect:React.useEffect,
    chefMemberText:x=>x,isChefConversationEnabled:()=>false,
    useNarration:()=>({reset:noop,toggleMode:noop}),
    motion:{div:dom("div")},AnimatePresence:React.Fragment,
    PillButton:dom("button"),setTimeout,
  };
  for(const n of nodes.filter(n=>within(n)&&(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)))){
    const tag=n.tagName.getText(ast);
    if(/^[A-Z]\w*$/.test(tag)&&!(tag in context))context[tag]=dom("span");
  }
  const compiled=require("esbuild").transformSync(
    libraryItem.getText(ast)+"\nmodule.exports = LibraryItem;",
    {loader:"tsx",format:"cjs",jsxFactory:"React.createElement",jsxFragment:"React.Fragment"}
  ).code;
  vm.runInNewContext(compiled,context);
  const topic={id:"offline-education",title:"Educational title",subtitle:"Educational subtitle",
    icon:dom("span"),content:{sections:[{heading:"Section heading",text:"Complete educational text",list:["First preserved item"]}]}};
  const render=expanded=>renderToStaticMarkup(React.createElement(context.module.exports,{topic,initialExpanded:expanded}));
  const collapsed=render(false),expanded=render(true);
  assert.ok(!collapsed.includes("Complete educational text"));
  assert.ok(expanded.includes("Complete educational text"));
  assert.ok(expanded.includes("First preserved item"));
  assert.match(expanded,/<div[^>]*hidden=""[^>]*style="display:none"[^>]*>.*?Read.*?Listen.*?<\/div>/s);
});
