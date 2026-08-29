import { useMemo } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import DOMPurify from "dompurify";

// Renders recruiter-authored HTML (job.description) on public pages.
// The Tiptap editor that produces this HTML can't emit a <script> tag,
// but a raw API call bypassing the editor could — so this never trusts
// stored HTML without sanitizing it first, since it's shown to
// unauthenticated visitors on the job board/apply page. See
// RichTextEditor.tsx.
export default function RichText({ html, sx }: { html: string; sx?: SxProps<Theme> }) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html]);

  return (
    <Box
      sx={[
        {
          "& p": { m: 0, mb: 1 },
          "& p:last-child": { mb: 0 },
          "& ul, & ol": { pl: 3, mb: 1 },
          "& h1, & h2, & h3": { fontWeight: 700, mt: 2, mb: 1 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
