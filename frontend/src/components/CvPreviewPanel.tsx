import { useEffect, useRef } from "react";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";

import { useCandidateCv } from "../api/candidates";

// Shared between Candidate Detail (full page) and the Candidates-list
// Quick View drawer — same fetch-as-blob-then-iframe approach either way
// (see useCandidateCv: auth is a Bearer header, so a plain <iframe src>
// straight to the API endpoint wouldn't carry it).
export default function CvPreviewPanel({ candidateId, height = 480 }: { candidateId: string | null; height?: number }) {
  const { data: cv, isLoading, isError } = useCandidateCv(candidateId);

  const prevUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== cv?.url) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    prevUrlRef.current = cv?.url ?? null;
  }, [cv?.url]);
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography sx={{ fontWeight: 700 }}>CV preview</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadOutlinedIcon fontSize="small" />}
          disabled={!cv}
          component="a"
          href={cv?.url}
          download={cv?.filename}
        >
          Download
        </Button>
      </Stack>
      {isLoading ? (
        <Stack sx={{ alignItems: "center", py: 4 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : isError ? (
        <Alert severity="info">No CV on file for this candidate.</Alert>
      ) : cv ? (
        <iframe
          title="CV preview"
          // Fit-to-width, no thumbnail/outline side panel — see
          // docs/06-ui-design-system.md for the param-name split between
          // Chromium (navpanes/view) and Firefox pdf.js (pagemode/zoom).
          src={`${cv.url}#navpanes=0&pagemode=none&view=FitH&zoom=page-width`}
          style={{ width: "100%", height, border: "none", borderRadius: 12 }}
        />
      ) : null}
    </Stack>
  );
}
