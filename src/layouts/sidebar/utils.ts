import type { FileStatus } from "src/types/electron";

export type TreeNode = {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileStatus;
};

export function buildTree(files: FileStatus[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.replace(/\\/g, "/").split("/");
    let nodes = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      if (isLast) {
        nodes.push({
          name: part,
          fullPath: file.path,
          isDir: false,
          children: [],
          file,
        });
      } else {
        let dir = nodes.find((n) => n.isDir && n.name === part);
        if (!dir) {
          dir = { name: part, fullPath, isDir: true, children: [] };
          nodes.push(dir);
        }
        nodes = dir.children;
      }
    }
  }
  return root;
}
