// Shared between seed-demo-fixture.mjs and reset-demo-fixture.mjs.
// Deliberately its own module with no side effects: reset-demo-fixture.mjs
// needs DEMO_COMPANY_NAME without ever triggering seed-demo-fixture.mjs's
// own top-level `main()` call, which a direct import from that script
// would have done.
export const DEMO_COMPANY_NAME = "DEMO — Statura Reference Manufacturing";
