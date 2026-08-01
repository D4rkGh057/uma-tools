export interface ResultsState {
	courseId: number | string;
	results: any[];
	runData: any;
	chartData: any;
	displaying: string;
	spurtInfo: any;
	staminaStats: any;
	firstUmaStats: any;
}

export interface ResultUpdate {
	results: any[];
	runData: any;
	spurtInfo?: any;
	staminaStats?: any;
	firstUmaStats?: any;
}

export function createEmptyResultsState(courseId: number | string): ResultsState {
	return {courseId, results: [], runData: null, chartData: null, displaying: '', spurtInfo: null, staminaStats: null, firstUmaStats: null};
}

export function updateResultsState(state: ResultsState, update: number | string | ResultUpdate): ResultsState {
	if (typeof update == 'number') {
		return createEmptyResultsState(update);
	} else if (typeof update == 'string') {
		return {
			courseId: state.courseId,
			results: state.results,
			runData: state.runData,
			chartData: state.runData != null ? state.runData[update] : null,
			displaying: update,
			spurtInfo: state.spurtInfo,
			staminaStats: state.staminaStats,
			firstUmaStats: state.firstUmaStats
		};
	}
	return {
		courseId: state.courseId,
		results: update.results,
		runData: update.runData,
		chartData: update.runData[state.displaying || 'meanrun'],
		displaying: state.displaying || 'meanrun',
		spurtInfo: update.spurtInfo || null,
		staminaStats: update.staminaStats || null,
		firstUmaStats: update.firstUmaStats || null
	};
}

function mergeSkillMaps(map1, map2) {
	const obj1 = map1 instanceof Map ? Object.fromEntries(map1) : (map1 || {});
	const obj2 = map2 instanceof Map ? Object.fromEntries(map2) : (map2 || {});
	const merged = { ...obj1 };
	Object.entries(obj2).forEach(([skillId, values]: [string, any]) => {
		merged[skillId] = [...(merged[skillId] || []), ...(values || [])];
	});
	return merged;
}

export function mergeResults(results1, results2) {
	console.assert(results1.id == results2.id, `mergeResults: ${results1.id} != ${results2.id}`);
	const n1 = results1.results.length, n2 = results2.results.length;
	const combinedResults = results1.results.concat(results2.results).sort((a,b) => a - b);
	const combinedMean = (results1.mean * n1 + results2.mean * n2) / (n1 + n2);
	const mid = Math.floor(combinedResults.length / 2);
	const newMedian = combinedResults.length % 2 == 0 ? (combinedResults[mid-1] + combinedResults[mid]) / 2 : combinedResults[mid];

	const allruns1 = results1.runData?.allruns || {};
	const allruns2 = results2.runData?.allruns || {};
	const {skBasinn: skBasinn1, sk: sk1, totalRuns: totalRuns1, ...rest1} = allruns1;
	const {skBasinn: skBasinn2, sk: sk2, totalRuns: totalRuns2, ...rest2} = allruns2;

	const mergedAllRuns: any = {
		...rest1,
		...rest2,
		totalRuns: (totalRuns1 || 0) + (totalRuns2 || 0)
	};

	if (skBasinn1 && skBasinn2) {
		mergedAllRuns.skBasinn = [
			mergeSkillMaps(skBasinn1[0] || {}, skBasinn2[0] || {}),
			mergeSkillMaps(skBasinn1[1] || {}, skBasinn2[1] || {})
		];
	} else if (skBasinn1 || skBasinn2) {
		mergedAllRuns.skBasinn = skBasinn1 || skBasinn2;
	}

	if (sk1 && sk2) {
		mergedAllRuns.sk = [
			mergeSkillMaps(sk1[0] || {}, sk2[0] || {}),
			mergeSkillMaps(sk1[1] || {}, sk2[1] || {})
		];
	} else if (sk1 || sk2) {
		mergedAllRuns.sk = sk1 || sk2;
	}

	return {
		id: results1.id,
		results: combinedResults,
		min: Math.min(results1.min, results2.min),
		max: Math.max(results1.max, results2.max),
		mean: combinedMean,
		median: newMedian,
		runData: {
			...(n2 > n1 ? results2.runData : results1.runData),
			allruns: mergedAllRuns,
			minrun: results1.min < results2.min ? results1.runData.minrun : results2.runData.minrun,
			maxrun: results1.max > results2.max ? results1.runData.maxrun : results2.runData.maxrun,
		}
	};
}
