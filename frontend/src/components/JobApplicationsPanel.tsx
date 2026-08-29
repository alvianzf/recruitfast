import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";

import {
  useAddScreeningQuestion,
  useApplications,
  useDeleteScreeningQuestion,
  useMarkEligible,
  useScreeningQuestions,
  type Application,
  type ScreeningQuestion,
  type ScreeningQuestionType,
} from "../api/screening";
import { useBlacklistStatuses } from "../api/blacklist";
import BlacklistBadge from "./BlacklistBadge";

function ScreeningQuestionsEditor({ jobId }: { jobId: string }) {
  const { data: questions } = useScreeningQuestions(jobId);
  const addQuestion = useAddScreeningQuestion(jobId);
  const deleteQuestion = useDeleteScreeningQuestion(jobId);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<ScreeningQuestionType>("text");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [expectedBoolean, setExpectedBoolean] = useState<"yes" | "no">("yes");
  const [minValue, setMinValue] = useState("");
  const [required, setRequired] = useState(true);

  const canAdd =
    questionText.trim() && (!required || questionType !== "number" || minValue.trim() !== "") &&
    (!required || questionType !== "text" || expectedAnswer.trim() !== "");

  async function handleAdd() {
    if (!canAdd) return;
    await addQuestion.mutateAsync({
      question_text: questionText,
      question_type: questionType,
      required,
      expected_answer: questionType === "text" ? expectedAnswer : questionType === "boolean" ? expectedBoolean : null,
      min_value: questionType === "number" && minValue !== "" ? Number(minValue) : null,
    });
    setQuestionText("");
    setExpectedAnswer("");
    setExpectedBoolean("yes");
    setMinValue("");
    setRequired(true);
    setQuestionType("text");
  }

  const columns: GridColDef<ScreeningQuestion>[] = [
    { field: "question_text", headerName: "Question", flex: 2, minWidth: 220 },
    {
      field: "question_type",
      headerName: "Type",
      width: 110,
      valueGetter: (_v, row) => (row.question_type === "boolean" ? "Yes / No" : row.question_type === "number" ? "Number" : "Text"),
    },
    {
      field: "required",
      headerName: "Required",
      width: 100,
      renderCell: (params) => (params.value ? <Chip size="small" label="Required" color="secondary" variant="outlined" /> : "—"),
    },
    {
      field: "criteria",
      headerName: "Pass criteria",
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) =>
        !row.required ? "Informational only" : row.question_type === "number" ? `Min: ${row.min_value}` : `Expected: ${row.expected_answer}`,
    },
    {
      field: "actions",
      headerName: "",
      width: 60,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <IconButton size="small" onClick={() => deleteQuestion.mutate(params.row.id)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Stack spacing={1.5}>
      {questions && questions.length > 0 && (
        <DataGrid
          autoHeight
          rows={questions}
          columns={columns}
          density="compact"
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: "none" }}
        />
      )}
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          label="Question"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          sx={{ flex: 2, minWidth: 200 }}
        />
        <TextField
          size="small"
          select
          label="Type"
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value as ScreeningQuestionType)}
          sx={{ width: 130 }}
        >
          <MenuItem value="text">Text</MenuItem>
          <MenuItem value="number">Number (min)</MenuItem>
          <MenuItem value="boolean">Yes / No</MenuItem>
        </TextField>
        {questionType === "text" && (
          <TextField
            size="small"
            label="Expected answer"
            value={expectedAnswer}
            onChange={(e) => setExpectedAnswer(e.target.value)}
            disabled={!required}
            sx={{ flex: 1, minWidth: 160 }}
          />
        )}
        {questionType === "number" && (
          <TextField
            size="small"
            type="number"
            label="Minimum (e.g. years)"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            disabled={!required}
            sx={{ width: 170 }}
          />
        )}
        {questionType === "boolean" && (
          <TextField
            size="small"
            select
            label="Expected answer"
            value={expectedBoolean}
            onChange={(e) => setExpectedBoolean(e.target.value as "yes" | "no")}
            disabled={!required}
            sx={{ width: 130 }}
          >
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </TextField>
        )}
        <FormControlLabel
          control={<Checkbox size="small" checked={required} onChange={(e) => setRequired(e.target.checked)} />}
          label="Required"
          sx={{ whiteSpace: "nowrap" }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleAdd}
          disabled={!canAdd || addQuestion.isPending}
          sx={{ whiteSpace: "nowrap" }}
        >
          Add
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Required questions filter out unqualified candidates automatically. A number question fails the
        candidate if their answer is below the minimum; a text question fails on a non-match.
      </Typography>
      {addQuestion.isError && (
        <Typography variant="caption" color="error">
          Could not add — check your role's question limit.
        </Typography>
      )}
    </Stack>
  );
}

function NotEligibleApplicants({
  jobId,
  onOpenCandidate,
}: {
  jobId: string;
  onOpenCandidate: (candidateId: string) => void;
}) {
  const { data: applications } = useApplications(jobId, false);
  const markEligible = useMarkEligible(jobId);
  const { data: blacklistStatuses } = useBlacklistStatuses(applications?.map((a) => a.candidate.email) ?? []);

  if (!applications || applications.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No applicants waiting on a review.
      </Typography>
    );
  }

  const columns: GridColDef<Application>[] = [
    {
      field: "candidateName",
      headerName: "Name",
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => row.candidate.full_name,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", height: "100%" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {params.row.candidate.full_name}
          </Typography>
          <BlacklistBadge
            status={blacklistStatuses?.find((s) => s.email.toLowerCase() === params.row.candidate.email?.toLowerCase())}
          />
        </Stack>
      ),
    },
    {
      field: "failedCriteria",
      headerName: "Failed screening",
      flex: 2,
      minWidth: 260,
      renderCell: (params) => (
        <Stack sx={{ py: 0.5 }}>
          {params.row.answers
            .filter((a) => a.required && !a.matched)
            .map((a) => (
              <Typography key={a.question_id} variant="caption" color="text.secondary" noWrap>
                "{a.question_text}" — answered <strong>{a.answer || "(blank)"}</strong>, expected{" "}
                {a.question_type === "number" ? `at least ${a.min_value}` : a.expected_answer}
              </Typography>
            ))}
        </Stack>
      ),
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="contained"
          onClick={(e) => {
            e.stopPropagation();
            markEligible.mutate(params.row.id);
          }}
          disabled={markEligible.isPending}
          sx={{ whiteSpace: "nowrap" }}
        >
          Move to eligible
        </Button>
      ),
    },
  ];

  return (
    <DataGrid
      autoHeight
      rows={applications}
      columns={columns}
      density="compact"
      getRowHeight={() => "auto"}
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
      onRowClick={(params) => onOpenCandidate(params.row.candidate.id)}
      sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" }, "& .MuiDataGrid-cell": { py: 0.5 } }}
    />
  );
}

export default function JobApplicationsPanel({
  jobId,
  onOpenCandidate,
}: {
  jobId: string;
  onOpenCandidate: (candidateId: string) => void;
}) {
  // Same query key as the one NotEligibleApplicants uses below — react-query
  // dedupes this to a single request, this just also surfaces the count up
  // here for the accordion header's badge.
  const { data: notEligibleApplications } = useApplications(jobId, false);

  return (
    <Stack spacing={1}>
      <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>Screening questions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ScreeningQuestionsEditor jobId={jobId} />
        </AccordionDetails>
      </Accordion>
      <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Typography sx={{ fontWeight: 700 }}>Not-eligible applicants</Typography>
            <Badge
              badgeContent={notEligibleApplications?.length ?? 0}
              color="error"
              max={99}
              sx={{ "& .MuiBadge-badge": { position: "static", transform: "none" } }}
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <NotEligibleApplicants jobId={jobId} onOpenCandidate={onOpenCandidate} />
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
