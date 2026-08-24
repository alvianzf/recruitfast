import { useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Box, Chip, IconButton, Menu, MenuItem, Paper, Stack, Typography } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import type { JobStage, Placement } from "../api/pipeline";

interface KanbanBoardProps {
  stages: JobStage[];
  placements: Placement[];
  onMove: (placementId: string, toStageId: string) => void;
  onReject: (placementId: string) => void;
  onWithdraw: (placementId: string) => void;
}

function PlacementCard({
  placement,
  onReject,
  onWithdraw,
}: {
  placement: Placement;
  onReject: () => void;
  onWithdraw: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: placement.id });
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        p: 1.5,
        mb: 1.25,
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        position: "relative",
        zIndex: isDragging ? 10 : "auto",
      }}
      {...listeners}
      {...attributes}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {placement.candidate.full_name}
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
              color={placement.status === "rejected" ? "error" : "default"}
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          )}
        </Box>
        {/* Stops propagation so the ⋮ click doesn't start a drag — same
            "open detail vs quick action" separation as everywhere else. */}
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
  );
}

function StageColumn({
  stage,
  placements,
  onReject,
  onWithdraw,
}: {
  stage: JobStage;
  placements: Placement[];
  onReject: (id: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        width: 280,
        flexShrink: 0,
        p: 1.5,
        backdropFilter: "none",
        bgcolor: isOver ? "action.hover" : "background.paper",
        border: "1px solid",
        borderColor: isOver ? "primary.main" : "divider",
        display: "flex",
        flexDirection: "column",
        minHeight: 200,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5, px: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {stage.name}
        </Typography>
        <Chip size="small" label={placements.length} />
      </Stack>
      <Box sx={{ flex: 1 }}>
        {placements.map((p) => (
          <PlacementCard key={p.id} placement={p} onReject={() => onReject(p.id)} onWithdraw={() => onWithdraw(p.id)} />
        ))}
      </Box>
    </Paper>
  );
}

export default function KanbanBoard({ stages, placements, onMove, onReject, onWithdraw }: KanbanBoardProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const placement = placements.find((p) => p.id === active.id);
    if (placement && placement.current_stage_id !== over.id) {
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
            placements={placements.filter((p) => p.current_stage_id === stage.id)}
            onReject={onReject}
            onWithdraw={onWithdraw}
          />
        ))}
      </Stack>
    </DndContext>
  );
}
