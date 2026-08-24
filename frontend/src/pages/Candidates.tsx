import {
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

export default function Candidates() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        Candidates
      </Typography>
      <TableContainer component={Paper} sx={{ backdropFilter: "none" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Active pipelines</TableCell>
              <TableCell>Source</TableCell>
              <TableCell align="right">Latest CV</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4}>
                <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                  No candidates yet.
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
