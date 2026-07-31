import { modeAdapters, isEvaluationMode } from './modeAdapters';
import { optimize } from './optimize';
import { CandidateBreakdown, EvaluationRequest, EvaluationResult, GroupBreakdown, OptimizeInput, Plan } from './types';

export function evaluatePurchase(input: OptimizeInput): Plan {
	return optimize(input);
}

export function buildPurchaseBreakdown(input: OptimizeInput, plan: Plan): readonly GroupBreakdown[] {
	return plan.picks.map(pick => ({
		groupId: pick.groupId,
		ownedSkillId: null,
		candidates: [{
			skillId: pick.skillId,
			cost: pick.cost,
			score: pick.score,
			picked: true,
			excluded: false,
			exclusionReason: null,
		}] satisfies readonly CandidateBreakdown[],
	}));
}

export function evaluate(request: EvaluationRequest): EvaluationResult {
	if (!isEvaluationMode(request.mode)) {
		return { status: 'invalid', mode: request.mode, reason: 'Unsupported evaluation mode' };
	}

	const { mode, profile, ...purchaseInput } = request;
	const purchase = evaluatePurchase(purchaseInput);
	return modeAdapters[mode](purchase, buildPurchaseBreakdown(purchaseInput, purchase), profile);
}
