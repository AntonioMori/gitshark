import React, { useState } from "react";
import Box from "@mui/material/Box";

import type { GroupedRef } from "./commit-graph-types";
import { chipBg } from "./utils";

// ----------------------------------------------------------------------

export { groupRefs } from "./utils";
export type { GroupedRef } from "./commit-graph-types";

// ----------------------------------------------------------------------

const ICON = {
  computer:
    '<svg width="11" height="11" viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><path d="M24 41c-9.62 0-15-.41-17.757-.734c-1.603-.19-2.75-1.264-2.923-2.87a61 61 0 0 1-.197-2.297A1.973 1.973 0 0 1 5.1 33h11.697c.702 0 1.323.455 1.534 1.125c.21.67.831 1.125 1.534 1.125h8.27c.701 0 1.322-.455 1.533-1.125A1.61 1.61 0 0 1 31.202 33h11.696c1.143 0 2.057.959 1.979 2.1a61 61 0 0 1-.197 2.297c-.173 1.605-1.32 2.68-2.924 2.869C39.002 40.59 33.62 41 24 41"/><path d="M5.314 33C5.142 30.792 5 27.58 5 23c0-5.89.235-9.518.466-11.658c.189-1.755 1.402-3.084 3.141-3.383C11.194 7.513 15.927 7 24 7s12.806.513 15.393.959c1.74.299 2.952 1.628 3.141 3.383c.23 2.14.466 5.767.466 11.658c0 4.58-.142 7.792-.314 10"/></g></svg>',
  cloud:
    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 12.5a3 3 0 0 1-.3-6A4 4 0 0 1 12 7.6a2.6 2.6 0 0 1-.6 4.9z"/></svg>',
  tag: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h5l7 7-5 5-7-7z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg>',
  check:
    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
};

// ----------------------------------------------------------------------

export function RefLabels({
  groups,
  laneColor,
  isCreatingBranch,
  onCancel,
  onSubmit,
}: {
  groups: GroupedRef[];
  laneColor: string;
  isCreatingBranch?: boolean;
  onCancel?: () => void;
  onSubmit?: (name: string) => void;
}) {
  if (isCreatingBranch) {
    return (
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: "100%",
          zIndex: 10,
        }}
      >
        <BranchInput laneColor={laneColor} onCancel={onCancel} onSubmit={onSubmit} />
      </Box>
    );
  }

  if (groups.length === 0) return <div />;

  const primary = groups[0];
  const overflow = groups.slice(1);
  const hasOverflow = overflow.length > 0;
  const bg = chipBg(laneColor, 0.25);
  const bgDark = chipBg(laneColor, 0.14);

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        gap: "4px",
        zIndex: 0,
        "&:hover": { zIndex: 10 },
        "&:hover .ref-expanded": { display: "flex" },
        "&:hover .ref-badge": hasOverflow
          ? { opacity: 0, pointerEvents: "none" }
          : undefined,
      }}
    >
      <RefChip group={primary} laneColor={laneColor} />

      {hasOverflow && (
        <Box
          className="ref-badge"
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: bgDark,
            borderRadius: "2px",
            px: "5px",
            fontSize: 10.5,
            fontWeight: 700,
            color: "rgba(255,255,255,1)",
            flexShrink: 0,
            transition: "opacity .1s",
          }}
        >
          +{overflow.length}
        </Box>
      )}

      {hasOverflow && (
        <Box
          className="ref-expanded"
          sx={{
            display: "none",
            position: "absolute",
            top: 0,
            left: "12px",
            flexDirection: "column",
            bgcolor: bg,
            borderRadius: "2px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            minWidth: 180,
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          <RefExpandedRow group={primary} laneColor={laneColor} isPrimary />
          {overflow.map((g, i) => (
            <RefExpandedRow key={i} group={g} laneColor={laneColor} />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function RefChip({
  group,
  laneColor,
}: {
  group: GroupedRef;
  laneColor: string;
}) {
  const { ref, remote, isCurrent, isTag } = group;
  const bg = chipBg(laneColor, isCurrent ? 0.50 : 0.25);

  const rightIcons: string[] = [];
  if (!isTag) {
    if (ref.type !== "remote") rightIcons.push(ICON.computer);
    if (remote || ref.type === "remote") rightIcons.push(ICON.cloud);
  }

  const title = remote ? `${ref.name}  ·  ${remote.name}` : ref.name;

  return (
    <Box
      component="span"
      title={title}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        bgcolor: bg,
        borderRadius: "2px",
        px: "6px",
        ml: "12px",
        height: "var(--row-h)",
        minHeight: "var(--row-h)",
        maxHeight: "var(--row-h)",
        fontSize: 13,
        fontWeight: 500,
        color: "#fff",
        overflow: "hidden",
        whiteSpace: "nowrap",
        minWidth: 0,
        maxWidth: 120,
      }}
    >
      {isCurrent && (
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: ICON.check }}
        />
      )}
      {isTag && !isCurrent && (
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: ICON.tag }}
        />
      )}
      <Box
        component="span"
        sx={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
      >
        {ref.name.replace(/^origin\//, "")}
      </Box>
      {rightIcons.map((svg, idx) => (
        <Box
          key={idx}
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            opacity: 0.6,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

function RefExpandedRow({
  group,
  laneColor,
  isPrimary,
}: {
  group: GroupedRef;
  laneColor: string;
  isPrimary?: boolean;
}) {
  const { ref, remote, isCurrent, isTag } = group;
  const bg = chipBg(laneColor, isCurrent ? 0.50 : 0.25);

  let leftIcon: string | null = null;
  if (isCurrent) leftIcon = ICON.check;
  else if (isTag) leftIcon = ICON.tag;

  const rightIcons: string[] = [];
  if (!isTag) {
    if (ref.type !== "remote") rightIcons.push(ICON.computer);
    if (remote || ref.type === "remote") rightIcons.push(ICON.cloud);
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        px: "6px",
        height: "var(--row-h)",
        minHeight: "var(--row-h)",
        maxHeight: "var(--row-h)",
        fontSize: 11,
        fontWeight: 500,
        color: "#fff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        bgcolor: isPrimary ? bg : chipBg(laneColor, 0.15),
        "&:hover": isPrimary ? undefined : { bgcolor: chipBg(laneColor, 0.3) },
      }}
    >
      {leftIcon && (
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: leftIcon }}
        />
      )}
      <Box
        component="span"
        sx={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
      >
        {ref.name.replace(/^origin\//, "")}
      </Box>
      {rightIcons.map((svg, idx) => (
        <Box
          key={idx}
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            opacity: 0.6,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

function BranchInput({
  laneColor,
  onCancel,
  onSubmit,
}: {
  laneColor: string;
  onCancel?: () => void;
  onSubmit?: (name: string) => void;
}) {
  const [val, setVal] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = val.trim();
      if (trimmed && onSubmit) {
        onSubmit(trimmed);
      } else if (onCancel) {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (onCancel) onCancel();
    }
  };

  return (
    <Box
      component="input"
      autoFocus
      placeholder="digite aqui"
      value={val}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      sx={{
        position: "absolute",
        left: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        bgcolor: "#16181c",
        borderRadius: "4px",
        px: "8px",
        height: "26px",
        minHeight: "26px",
        maxHeight: "26px",
        fontSize: 11.5,
        fontWeight: 400,
        color: "#fff",
        border: "1px solid #292a2e",
        outline: "none",
        "&:focus": {
          borderColor: "#0669f7",
        },
        width: 180,
        fontFamily: "inherit",
        boxSizing: "border-box",
        zIndex: 10,
        "&::placeholder": {
          color: "rgba(255, 255, 255, 0.4)",
        },
      }}
    />
  );
}
