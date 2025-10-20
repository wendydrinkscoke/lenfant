import { Milestone } from 'gallaudet-api-typescript-runtime';

type InvalidMilestoneResult = { error: 'invalid-milestone' };

export type MilestoneProgress = {
  orderedCompletionIds: string[];
  cumulativePercentage: number;
  nextMilestone?: Milestone;
};

const buildCompletionSet = (
  milestones: readonly Milestone[],
  completedMilestoneIds: readonly string[],
): Set<string> => {
  const validIds = new Set(milestones.map((milestone) => milestone.id));
  return new Set(completedMilestoneIds.filter((id) => validIds.has(id)));
};

export const computeMilestoneProgress = (
  milestones: readonly Milestone[],
  completedMilestoneIds: readonly string[],
): MilestoneProgress => {
  const completionSet = buildCompletionSet(milestones, completedMilestoneIds);

  const orderedCompletionIds = milestones
    .filter((milestone) => completionSet.has(milestone.id))
    .map((milestone) => milestone.id);

  const cumulativePercentage = milestones.reduce((total, milestone) => (
    completionSet.has(milestone.id)
      ? total + (milestone.percentageContribution ?? 0)
      : total
  ), 0);

  const nextMilestone = milestones.find((milestone) => !completionSet.has(milestone.id));

  return {
    orderedCompletionIds,
    cumulativePercentage,
    nextMilestone,
  };
};

export const normalizeAndAddMilestoneCompletion = (
  milestones: readonly Milestone[],
  milestoneId: string,
  existing: readonly string[] = [],
): MilestoneProgress | InvalidMilestoneResult => {
  const validIds = new Set(milestones.map((milestone) => milestone.id));
  if (!validIds.has(milestoneId)) {
    return { error: 'invalid-milestone' };
  }

  const completionSet = buildCompletionSet(milestones, existing);
  completionSet.add(milestoneId);

  return computeMilestoneProgress(milestones, Array.from(completionSet));
};
