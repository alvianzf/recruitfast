import { useState } from "react";
import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";

// Jobs list defaults to Table (see docs/03-pipelines-and-boards.md); the
// view toggle here is a placeholder — persisting the choice per-user,
// per-list to the backend is a follow-up once auth/user prefs exist.
type ViewMode = "table" | "kanban";

export default function Jobs() {
  const [view, setView] = useState<ViewMode>("table");

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Jobs
        </Typography>
        <Stack direction="row" spacing={2}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, next) => next && setView(next)}
          >
            <ToggleButton value="table">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="kanban">
              <ViewKanbanIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained">New job</Button>
        </Stack>
      </Stack>

      {view === "table" ? (
        <TableContainer component={Paper} sx={{ backdropFilter: "none" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell align="right">Candidates</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                    No jobs yet — create one to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Typography color="text.secondary">Kanban board — coming soon.</Typography>
        </Paper>
      )}
    </Stack>
  );
}
