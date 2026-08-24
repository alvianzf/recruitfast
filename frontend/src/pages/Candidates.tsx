import {
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";

import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function Candidates() {
  return (
    <Stack spacing={3}>
      <PageHeader title="Candidates" />
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
                <EmptyState
                  icon={<PeopleOutlinedIcon />}
                  title="No candidates yet"
                  description="Candidates you source or that apply to your jobs will show up here."
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
