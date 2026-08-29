import { useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Avatar, Box, Chip, IconButton, Menu, MenuItem, Paper, Stack, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import type { JobStage, Placement } from "../api/pipeline";
import { BRAND_PRIMARY, BRAND_PRIMARY_LIGHT, INK, getStatusColor } from "../theme";

interface KanbanBoardProps {
  stages: JobStage[];
  placements: Placement[];
  onMove: (placementId: string, toStageId: string) => void;
  onReject: (placementId: string) => void;
  onWithdraw: (placementId: string) => void;
  onOpenCandidate?: (candidateId: string) => void;
}

// Small deterministic palette for candidate initials avatars — distinct
// from the status-color family (those mean something specific; these are
// just a scanning aid), muted enough to sit quietly next to the stage
// accent border.
const AVATAR_PALETTE = ["#5B7FA6", "#8A6BAF", "#4A9D8F", "#B0855A", "#6B8E5A", "#A15B7F"];

function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[mix(ar, br), mix(ag, bg), mix(ab, bb)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// The pipeline should visually read left-to-right as "further along," not
// as a row of identical grey boxes in an arbitrary order — each stage
// gets an accent that progresses from neutral ink through brand blue
// toward the "won" violet as it nears the terminal-success stage; the
// terminal-reject stage always gets the "lost" brick red regardless of
// its position. Reused as both the column's top accent bar and each of
// its cards' left border, so a card mid-drag still visibly belongs to
// its stage.
function stageAccentColor(stage: JobStage, stages: JobStage[], mode: "light" | "dark"): string {
  if (stage.is_terminal_reject) return getStatusColor("lost", mode);
  if (stage.is_terminal_success) return getStatusColor("won", mode);
  const progress = stages.filter((s) => !s.is_terminal_reject);
  const idx = progress.findIndex((s) => s.id === stage.id);
  const t = progress.length > 1 ? idx / (progress.length - 1) : 0;
  const ink = mode === "dark" ? INK.dark[400] : INK.light[500];
  const primary = mode === "dark" ? BRAND_PRIMARY_LIGHT : BRAND_PRIMARY;
  const won = getStatusColor("won", mode);
  return t <= 0.6 ? mixHex(ink, primary, t / 0.6) : mixHex(primary, won, (t - 0.6) / 0.4);
}

function PlacementCard({
  placement,
  accentColor,
  celebrate,
  onReject,
  onWithdraw,
  onOpen,
}: {
  placement: Placement;
  accentColor: string;
  celebrate: boolean;
  onReject: () => void;
  onWithdraw: () => void;
  onOpen?: () => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  // MUI's Menu portals its DOM elsewhere, but stays a React-tree child of
  // this Paper — so without this, a pointerdown on a MenuItem (dismissing
  // the menu, or picking an action) still bubbles through React's synthetic
  // tree into dnd-kit's activator below, misread as "grabbed the card."
  // That swallowed the click and animated a drag-cancel snap-back instead
  // of ever calling the menu item's own handler — the menu looked stuck,
  // and "Mark as Rejected" looked like it did nothing but shake the card
  // (bug found 2026-08-27). Disabling the draggable while its own menu is
  // open removes dnd-kit's listeners from the Paper entirely for that
  // window, so nothing above the MenuItem can intercept the click.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: placement.id,
    disabled: !!menuAnchor,
  });
  const name = placement.candidate.full_name;

  return (
    <motion.div
      initial={celebrate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Paper
        ref={setNodeRef}
        elevation={isDragging ? 6 : 0}
        onClick={() => !isDragging && onOpen?.()}
        sx={{
          p: 1.5,
          mb: 1.25,
          cursor: isDragging ? "grabbing" : "pointer",
          opacity: isDragging ? 0.9 : 1,
          transform: [
            transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : "",
            isDragging ? "rotate(2deg)" : "",
          ]
            .filter(Boolean)
            .join(" "),
          position: "relative",
          zIndex: isDragging ? 10 : "auto",
          borderLeft: `3px solid ${accentColor}`,
          transition: "box-shadow 150ms ease, transform 150ms ease",
          "&:hover": { boxShadow: isDragging ? undefined : 3 },
        }}
        {...listeners}
        {...attributes}
      >
        <Stack direction="row" spacing={1.25} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Stack direction="row" spacing={1.25} sx={{ minWidth: 0, alignItems: "flex-start" }}>
            <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: avatarColorFor(name) }}>
              {initialsFor(name)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {name}
              </Typography>
              {placement.candidate.current_position && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {placement.candidate.current_position}
                </Typography>
              )}
              {placement.status !== "active" && (
                <Chip
                  size="small"
                  label={placement.status}
                  sx={{
                    mt: 0.5,
                    height: 18,
                    fontSize: "0.625rem",
                    bgcolor: getStatusColor(placement.status),
                    color: "#fff",
                  }}
                />
              )}
            </Box>
          </Stack>
          {/* Stops propagation so the ⋮ click doesn't start a drag or open
              the quick view — same "open detail vs quick action" separation
              as everywhere else. */}
          <IconButton
            size="small"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget);
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onReject();
            }}
          >
            Mark as Rejected
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onWithdraw();
            }}
          >
            Mark as Withdrawn
          </MenuItem>
        </Menu>
      </Paper>
    </motion.div>
  );
}

function StageColumn({
  stage,
  stages,
  placements,
  arrivedIds,
  onReject,
  onWithdraw,
  onOpenCandidate,
}: {
  stage: JobStage;
  stages: JobStage[];
  placements: Placement[];
  arrivedIds: Set<string>;
  onReject: (id: string) => void;
  onWithdraw: (id: string) => void;
  onOpenCandidate?: (candidateId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const theme = useTheme();
  const accent = stageAccentColor(stage, stages, theme.palette.mode);

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        width: 280,
        flexShrink: 0,
        p: 1.5,
        pt: 0,
        bgcolor: isOver ? "action.hover" : "background.paper",
        border: "1px solid",
        borderColor: isOver ? "primary.main" : "divider",
        borderTop: `3px solid ${accent}`,
        display: "flex",
        flexDirection: "column",
        minHeight: 200,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5, mt: 1.5, px: 0.5 }}>
        <Typography variant="overline" sx={{ color: "text.secondary" }}>
          {stage.name}
        </Typography>
        <Chip size="small" label={placements.length} sx={{ bgcolor: accent, color: "#fff", fontWeight: 700 }} />
      </Stack>
      <Box sx={{ flex: 1 }}>
        {placements.map((p) => (
          <PlacementCard
            key={p.id}
            placement={p}
            accentColor={accent}
            celebrate={stage.is_terminal_success && arrivedIds.has(p.id)}
            onReject={() => onReject(p.id)}
            onWithdraw={() => onWithdraw(p.id)}
            onOpen={onOpenCandidate ? () => onOpenCandidate(p.candidate_id) : undefined}
          />
        ))}
      </Box>
    </Paper>
  );
}

export default function KanbanBoard({ stages, placements, onMove, onReject, onWithdraw, onOpenCandidate }: KanbanBoardProps) {
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(new Set());

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const placement = placements.find((p) => p.id === active.id);
    if (placement && placement.current_stage_id !== over.id) {
      const targetStage = stages.find((s) => s.id === over.id);
      if (targetStage?.is_terminal_success) {
        setArrivedIds((prev) => new Set(prev).add(placement.id));
      }
      onMove(placement.id, String(over.id));
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Stack direction="row" spacing={2} sx={{ overflowX: "auto", pb: 2 }}>
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            stages={stages}
            placements={placements.filter((p) => p.current_stage_id === stage.id)}
            arrivedIds={arrivedIds}
            onReject={onReject}
            onWithdraw={onWithdraw}
            onOpenCandidate={onOpenCandidate}
          />
        ))}
      </Stack>
    </DndContext>
  );
}
