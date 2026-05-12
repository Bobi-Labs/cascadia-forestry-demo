// Forestry-side stub for the bobi-worktracker `base-path` plumbing.
//
// bobi-worktracker can mount under a path prefix (e.g. /privatetracker) for
// embedded/multi-tenant deployments. Forestry mounts at the root, so the
// base path is always the empty string and `apiPath` / `appPath` are pass-
// through. Kept as a stub so wholesale-mirrored components from
// bobi-worktracker compile without code changes.

export const TRACKER_BASE_PATH = "";
export const apiPath = (path: string) => path;
export const appPath = (path: string) => path;
