// Vendor module shims for packages whose @types are missing from node_modules.
// These suppress TS7016 and provide minimal session typing.

declare module 'express-session' {
  import { RequestHandler } from 'express';
  interface SessionData {
    [key: string]: any;
  }
  interface Session extends SessionData {
    id: string;
    destroy(callback?: (err?: any) => void): this;
    regenerate(callback?: (err?: any) => void): this;
    reload(callback?: (err?: any) => void): this;
    save(callback?: (err?: any) => void): this;
    touch(): this;
    cookie: any;
  }
  function session(options?: any): RequestHandler;
  namespace session {
    interface Store {
      [key: string]: any;
    }
  }
  export = session;
}

declare module 'connect-pg-simple' {
  import { Store } from 'express-session';
  function connectPgSimple(session: any): any;
  export = connectPgSimple;
}

// Augment Express Request to expose session (populated by express-session middleware)
declare namespace Express {
  interface Request {
    session: import('express-session').Session & Partial<import('express-session').SessionData>;
    sessionID: string;
  }
}
