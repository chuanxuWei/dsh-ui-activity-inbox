/**
 * Activity Inbox node half.
 *
 * The product behavior lives in the browser bundle declared by `dsh.client`;
 * the node entry is present so the DSH Loader can mount this package through
 * the ordinary Cordis graph.
 */

/** Cordis plugin name. */
export const name = 'ui-activity-inbox'

/** No host-side behavior is needed for this read-only client projection. */
export function apply(): void {}
