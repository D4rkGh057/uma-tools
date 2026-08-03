import type { RunningStyle } from '../optimizer/profiles/types';

/** Human-readable names for the five running styles, shared by `MetaMatchupPanel` (read) and
 *  `CommunityGuidanceForm` (write) so both surfaces label styles identically. */
export const RUNNING_STYLE_LABELS: Record<RunningStyle, string> = {
	1: 'Front Runner',
	2: 'Pace Chaser',
	3: 'Late Surger',
	4: 'End Closer',
	5: 'Runaway',
};
