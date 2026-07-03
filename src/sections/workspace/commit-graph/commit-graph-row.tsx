import Box from "@mui/material/Box";

import type { RowProps } from "./commit-graph-types";

// ----------------------------------------------------------------------

export function Row({ children, gridCols, sx, ...props }: RowProps) {
  return (
    <Box
      {...props}
      sx={{
        flexShrink: 0,
        height: "var(--row-h)",
        minHeight: "var(--row-h)",
        maxHeight: "var(--row-h)",
        display: "grid",
        gridTemplateColumns: gridCols,
        alignItems: "stretch",
        cursor: "pointer",
        "&:hover": { bgcolor: "rgba(255,255,255,0.045)" },
        "&:hover .when": { opacity: 1 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
