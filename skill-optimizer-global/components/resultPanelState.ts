import type { OptimizerBuildLoadOutcome } from '../optimizerBuildStorage';
import type { EvaluationResult } from '../optimizer/types';

type NonReadyEvaluationResult = Exclude<EvaluationResult, { readonly status: 'ready' }>;
type MigratedBuildOutcome = Extract<OptimizerBuildLoadOutcome, { readonly status: 'migrated' }>;

export type ResultPanelState = NonReadyEvaluationResult | MigratedBuildOutcome;

export function resultPanelStateContent(state: ResultPanelState) {
	if (state.status === 'unavailable') {
		return { message: `Rankings are unavailable: ${state.reason}` };
	}
	if (state.status === 'invalid') {
		return { message: `Invalid evaluation mode (${state.mode}): ${state.reason}` };
	}
	return { message: 'Saved optimizer build was migrated to Score mode.' };
}
