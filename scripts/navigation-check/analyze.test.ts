import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, classify } from "./analyze";

test("reads only registered routes from the explicit authority, not arbitrary metadata or fallback", () => {
  const source = '<><Route path="/auth" /><Route path="/meal/:id" /><Route component={NotFound}/></>';
  assert.deepEqual(analyze("Router.tsx", source, true).routes.map(ref => ref.value), ["/auth", "/meal/:id"]);
  assert.equal(analyze("other.tsx", source).routes.length, 0);
});

test("extracts ordinary controls, Copilot, Ask Chef, and App Library-style metadata", () => {
  const result = analyze("fixtures.tsx", `
    const destinations = { chef: { route: "/shopping-list-v2" }, library: { path: "/learn" } };
    const copilot = () => navigationHandler("/missing-copilot");
    const button = <button onClick={() => setLocation("/profile/edit")}>GLP-1</button>;
    const links = <><Link href="/academy" /><a href="/auth">Sign in</a></>;
  `);
  assert.deepEqual(result.destinations.map(ref => ref.value).sort(),
    ["/shopping-list-v2", "/learn", "/missing-copilot", "/profile/edit", "/academy", "/auth"].sort());
  assert.ok(result.destinations.every(ref => ref.line > 0 && ref.file === "fixtures.tsx"));
  assert.equal(classify("/profile/edit", ["/edit-profile", "/profile"]), "invalid");
});

test("matches registered static, parameter, optional and wildcard routes with query/hash", () => {
  for (const [target, route] of [
    ["/", "/"], ["/academy/", "/academy"], ["/meal/123", "/meal/:id"],
    ["/meal", "/meal/:id?"], ["/meal/123", "/meal/:id?"],
    ["/help/a/b", "/help/*"], ["/auth?next=%2Facademy#login", "/auth"],
  ]) assert.equal(classify(target, [route]), "matched", target);
  assert.equal(classify("/meal", ["/meal/:id"]), "invalid");
  assert.equal(classify("/meal/a/b", ["/meal/:id"]), "invalid");
  assert.equal(classify("/missing", ["*","/*"]), "invalid");
  assert.equal(classify("/academy-other", ["/academy"]), "invalid");
});

test("does not mistake assets, APIs, external destinations, or parameterized references for verified pages", () => {
  for (const target of ["/api/auth/google", "/api", "/terms.pdf", "https://example.org/a", "//example.org/a"])
    assert.equal(classify(target, ["/"]), "non-page");
  assert.equal(classify("/meal/:id", ["/meal/:id"]), "dynamic");
});

test("reports dynamic and imported expressions without a false pass, preserving known conditional branches", () => {
  const result = analyze("fixture.tsx", `
    navigate(importedRoute);
    navigate(\`/meal/\${id}\`);
    setLocation(ready ? "/auth" : unresolved);
    <Route path={importedRoute} />;
  `, true);
  assert.deepEqual(result.destinations.map(ref => ref.value), ["/auth"]);
  assert.equal(result.unresolved.length, 4);
  assert.equal(result.unresolved.filter(ref => ref.kind === "route").length, 1);
});

test("resolves unambiguous local constants, concatenation, arrays and casts", () => {
  const result = analyze("fixture.tsx", `
    const target = "/academy" as const;
    navigate(target);
    navigate("/auth" + "?from=academy");
    <Route path={["/auth", "/academy"]}/>;
  `, true);
  assert.deepEqual(result.destinations.map(ref => ref.value), ["/academy", "/auth?from=academy"]);
  assert.deepEqual(result.routes.map(ref => ref.value), ["/auth", "/academy"]);
  assert.equal(result.unresolved.length, 0);
});

test("comments and comparison strings are not navigation destinations; location assignments are", () => {
  const result = analyze("fixture.ts", `
    // navigate("/not-real");
    const description = "/text-only";
    window.location.pathname.startsWith("/comparison-only");
    window.location.href = "/auth";
    location.replace("/welcome");
  `);
  assert.deepEqual(result.destinations.map(ref => ref.value), ["/auth", "/welcome"]);
});

test("unsupported route syntax cannot mask an invalid destination", () => {
  assert.equal(classify("/missing", ["/(.*)"]), "invalid");
});

test("ignores URLSearchParams values, but reports relative links as unresolved", () => {
  const result = analyze("fixture.tsx", `
    const params = new URLSearchParams({ path: "/calendar/action/compose", to: "someone@example.org" });
    <a href="relative-destination">Relative</a>;
    <a href="mailto:someone@example.org">Email</a>;
  `);
  assert.equal(result.destinations.length, 0);
  assert.deepEqual(result.unresolved.map(ref => ref.value), ["relative-destination"]);
});

test("does not resolve a shadowed identifier to an unrelated constant", () => {
  const result = analyze("fixture.ts", `
    const target = "/auth";
    function move(target: string) { navigate(target); }
  `);
  assert.equal(result.destinations.length, 0);
  assert.equal(result.unresolved.length, 1);
});

test("recognizes Wouter setter aliases and browser history navigation", () => {
  const result = analyze("fixture.ts", `
    const [location, changePage] = useLocation();
    changePage("/missing");
    window.history.pushState({}, "", "/auth");
    window.location = "/welcome";
  `);
  assert.deepEqual(result.destinations.map(ref => ref.value), ["/missing", "/auth", "/welcome"]);
});

test("does not silently pass source that cannot be parsed", () => {
  assert.throws(() => analyze("broken.tsx", '<Link href="/auth"'), /Cannot analyze broken.tsx/);
});
