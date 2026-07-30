// One-time parse of every skill's `alternatives[].condition` string into an Operator tree, following
// the exact module-load pattern already proven in components/SkillPicker.tsx (`getParser` fed with
// `Matcher.mockConditions`, so parsed atoms carry the same cached condition-name identity objects
// that `Matcher.condMatcher`/`treeMatch` compare by reference).
import { getParser } from '../../uma-skill-tools/ConditionParser';
import * as Matcher from '../../uma-skill-tools/tools/ConditionMatcher';
import {
	Operator, CmpOperator, AndOperator, OrOperator,
	EqOperator, NeqOperator, LtOperator, LteOperator, GtOperator, GteOperator
} from '../../uma-skill-tools/ActivationConditions';
import { skillData } from './skillGroups';
import { RaceFact } from './types';

export const Parser = getParser(Matcher.mockConditions);

/** Parses a standalone probe expression (e.g. "distance_type==4") into a search Node, same helper
 *  pattern as SkillPicker.tsx's module-level `C()`. */
export function C(source: string) {
	return Parser.parseAny(Parser.tokenize(source));
}

export interface ParsedAlternative {
	tree: Operator;
	/** True if the tree contains an `@` (OR) anywhere. OR-trees are ambiguous for hard exclusion
	 *  (design decision #4): `condMatcher` recurses into both OR branches, so a conflict hit on one
	 *  branch is not proof the whole alternative can never activate. */
	hasOr: boolean;
}

function containsOr(node: Operator): boolean {
	if (node instanceof OrOperator) return true;
	if (node instanceof AndOperator) return containsOr(node.left) || containsOr(node.right);
	return false;
}

/** Number of leaf comparison atoms in a tree (AND-branches count each side; OR counts both branches
 *  too, used only by the generic condition-breadth heuristic in score.ts). */
export function countAtoms(node: Operator): number {
	if (node instanceof AndOperator || node instanceof OrOperator) {
		return countAtoms(node.left) + countAtoms(node.right);
	}
	return 1;
}

/** Every Cmp atom out of a PURE-AND (no OR) tree. Only meaningful when `hasOr === false` for that
 *  tree -- flattening an OR-containing tree this way would conflate mutually exclusive branches. */
export function collectAtoms(node: Operator): CmpOperator[] {
	if (node instanceof AndOperator) {
		return [...collectAtoms(node.left), ...collectAtoms(node.right)];
	}
	return [node as CmpOperator];
}

const parsedAlternatives: Record<string, ParsedAlternative[]> = {};
Object.keys(skillData).forEach(id => {
	parsedAlternatives[id] = skillData[id].alternatives.map(alt => {
		const tree = Parser.parse(Parser.tokenize(alt.condition));
		return { tree, hasOr: containsOr(tree) };
	});
});

export function getParsedAlternatives(skillId: string): ParsedAlternative[] {
	return parsedAlternatives[skillId] ?? [];
}

function atomConflictsWithFact(atom: CmpOperator, fact: RaceFact): boolean {
	const name = (atom.condition as unknown as { name?: string })?.name;
	if (name !== fact.condition) return false;
	const arg = (atom as unknown as { argument: number }).argument;
	if (atom instanceof EqOperator) return arg !== fact.value;
	if (atom instanceof NeqOperator) return arg === fact.value;
	if (atom instanceof LtOperator) return !(fact.value < arg);
	if (atom instanceof LteOperator) return !(fact.value <= arg);
	if (atom instanceof GtOperator) return !(fact.value > arg);
	if (atom instanceof GteOperator) return !(fact.value >= arg);
	return false;
}

function alternativeConflicts(alt: ParsedAlternative, facts: RaceFact[]): boolean {
	if (alt.hasOr) return false;
	const atoms = collectAtoms(alt.tree);
	return facts.some(fact => atoms.some(atom => atomConflictsWithFact(atom, fact)));
}

/**
 * True only when EVERY alternative of `skillId` is structurally impossible against `facts` (spec:
 * "Target-Race Hard Exclusion" / design decision #4 & #5). An alternative with any OR in its tree is
 * never counted as impossible, so a skill with even one ambiguous alternative is never hard-excluded
 * here -- it instead gets a score penalty via score.ts's fit calculation.
 */
export function isSkillImpossibleForRace(skillId: string, facts: RaceFact[]): boolean {
	if (facts.length === 0) return false;
	const alts = getParsedAlternatives(skillId);
	if (alts.length === 0) return false;
	return alts.every(alt => alternativeConflicts(alt, facts));
}
