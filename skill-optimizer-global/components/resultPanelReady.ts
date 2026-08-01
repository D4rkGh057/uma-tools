import { EvaluationResult } from '../optimizer/types';

export type ReadyEvaluationResult = Extract<EvaluationResult, { readonly status: 'ready' }>;

export function readyResultContent(result: ReadyEvaluationResult) {
	return { plan: result.purchase, breakdown: result.breakdown };
}
