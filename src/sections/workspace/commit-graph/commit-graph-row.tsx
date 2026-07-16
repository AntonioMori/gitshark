import Box from "@mui/material/Box";

import type { RowProps } from "./commit-graph-types";

// ----------------------------------------------------------------------

export function Row({ children, gridCols, sx, ...props }: RowProps) {
  return (
    <Box
      {...props}
      sx={{
        flexShrink: 0,
        height: "var(--row-stride, var(--row-h))",
        minHeight: "var(--row-stride, var(--row-h))",
        maxHeight: "var(--row-stride, var(--row-h))",
        display: "grid",
        gridTemplateColumns: gridCols,
        alignItems: "center",
        cursor: "pointer",
        "&:hover .commit-msg-col": { bgcolor: "#212939" },
        "&:hover .when": { opacity: 1 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
