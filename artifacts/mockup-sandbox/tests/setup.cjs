globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.scrollTo = jest.fn();
}
if (typeof window !== "undefined") window.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false, media: query, onchange: null,
  addListener: jest.fn(), removeListener: jest.fn(),
  addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
}));
