import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";

import {
  useAddScreeningQuestion,
  useApplications,
  useDeleteScreeningQuestion,
  useMarkEligible,
  useScreeningQuestions,
} from "../api/screening";
import { useBlacklistStatuses } from "../api/blacklist";
import BlacklistBadge from "./BlacklistBadge";

function ScreeningQuestionsEditor({ jobId }: { jobId: string }) {
  const { data: questions } = useScreeningQuestions(jobId);
  const addQuestion = useAddScreeningQuestion(jobId);
  const deleteQuestion = useDeleteScreeningQuestion(jobId);
  const [questionText, setQuestionText] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");

  async function handleAdd() {
    if (!questionText.trim() || !expectedAnswer.trim()) return;
    await addQuestion.mutateAsync({ question_text: questionText, expected_answer: expectedAnswer });
    setQuestionText("");
    setExpectedAnswer("");
  }

  return (
    <Stack spacing={1.5}>
      {questions?.map((q) => (
        <Stack key={q.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Chip size="small" label={`Expected: ${q.expected_answer}`} variant="outlined" />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {q.question_text}
          </Typography>
          <IconButton size="small" onClick={() => deleteQuestion.mutate(q.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" spacing={1.5}>
        <TextField
          size="small"
          label="Question"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Expected answer"
          value={expectedAnswer}
          onChange={(e) => setExpectedAnswer(e.target.value)}
          fullWidth
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleAdd}
          disabled={addQuestion.isPending}
          sx={{ whiteSpace: "nowrap" }}
        >
          Add
        </Button>
      </Stack>
      {addQuestion.isError && (
        <Typography variant="caption" color="error">
          Could not add — check your role's question limit.
        </Typography>
      )}
    </Stack>
  );
}

function NotEligibleApplicants({ jobId }: { jobId: string }) {
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

  return (
    <Stack spacing={1.5}>
      {applications.map((app) => (
        <Paper key={app.id} variant="outlined" sx={{ p: 2, backdropFilter: "none" }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography sx={{ fontWeight: 600 }}>{app.candidate.full_name}</Typography>
                <BlacklistBadge
                  status={blacklistStatuses?.find(
                    (s) => s.email.toLowerCase() === app.candidate.email?.toLowerCase(),
                  )}
                />
              </Stack>
              {app.answers.map((a) => (
                <Typography key={a.question_id} variant="caption" color="text.secondary">
                  "{a.question_text}" — answered <strong>{a.answer || "(blank)"}</strong>, expected {a.expected_answer}
                </Typography>
              ))}
            </Stack>
            <Button
              size="small"
              variant="contained"
              onClick={() => markEligible.mutate(app.id)}
              disabled={markEligible.isPending}
              sx={{ whiteSpace: "nowrap" }}
            >
              Move to eligible
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export default function JobApplicationsPanel({ jobId }: { jobId: string }) {
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
          <Typography sx={{ fontWeight: 700 }}>Not-eligible applicants</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <NotEligibleApplicants jobId={jobId} />
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
