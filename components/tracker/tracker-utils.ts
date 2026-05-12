/** Color mappings and utilities for the work tracker */

export const TRACKER_PROJECT_ID = "10000000-0000-0000-0000-000000000001";

export type TrackerCategory =
  | "data_needed"
  | "question"
  | "decision"
  | "task"
  | "bug"
  | "feature";

export type TrackerPriority = "high" | "medium" | "low";

export type TrackerStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "blocked"
  | "future_phase";

export const priorityColors: Record<TrackerPriority, string> = {
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export const statusColors: Record<TrackerStatus, string> = {
  pending: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  done: "bg-green-500/20 text-green-400 border-green-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
  future_phase: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

export const categoryColors: Record<TrackerCategory, string> = {
  data_needed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  question: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  decision: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  task: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  bug: "bg-red-500/20 text-red-400 border-red-500/30",
  feature: "bg-green-500/20 text-green-400 border-green-500/30",
};

export const statusLabels: Record<TrackerStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
  future_phase: "Future Phase",
};

export const categoryLabels: Record<TrackerCategory, string> = {
  data_needed: "Data Needed",
  question: "Question",
  decision: "Decision",
  task: "Task",
  bug: "Bug",
  feature: "Feature",
};

export const priorityLabels: Record<TrackerPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const statusOrder: TrackerStatus[] = [
  "pending",
  "in_progress",
  "blocked",
  "done",
  "future_phase",
];

/** Dev team members — notes from these authors show under "Dev Team" */
export const DEV_TEAM_MEMBERS = ["Bees"];

/** Determine if an author name belongs to the dev team */
export function isDevTeam(author: string): boolean {
  return DEV_TEAM_MEMBERS.some(
    (m) => m.toLowerCase() === author.toLowerCase(),
  );
}
