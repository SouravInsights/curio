/**
 * Which library an operation acts on.
 *
 * The one thing every service function needs, and the seam that lets the same
 * function serve one user in the app and another over HTTP: the caller resolves
 * it, the service never looks it up.
 */
export interface Scope {
  libraryId: number;
}
