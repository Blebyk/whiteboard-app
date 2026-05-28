// `@/lib/db` resolves here. The full schema, WAL/busy_timeout pragmas and the
// HMR-safe singleton connection live in the repo-root db module; re-export it so
// the whole app shares one connection and one source of truth for the schema.
export { default } from '../../lib/db';
