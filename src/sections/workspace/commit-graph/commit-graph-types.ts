import type { RepoPayload, RepoRef } from "src/types/electron";

// ----------------------------------------------------------------------

export type GroupedRef = {
  ref: RepoRef;
  remote?: RepoRef;
  isCurrent: boolean;
  isTag: boolean;
};

export type CommitGraphProps = {
  payload: RepoPayload;
  selectedIdx: number;
  onSelectRow: (idx: number) => void;
};

export type RowProps = {
  children: React.ReactNode;
  gridCols: string;
  sx?: object;
  [key: string]: unknown;
};
