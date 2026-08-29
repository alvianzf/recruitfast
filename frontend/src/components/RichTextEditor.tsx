import { Box, Divider, IconButton, Stack, ToggleButton, useTheme } from "@mui/material";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import TitleIcon from "@mui/icons-material/Title";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";

// A constrained WYSIWYG editor for job descriptions — bold/italic,
// headings, bullet/numbered lists, nothing else. Output is HTML, stored
// as-is in jobs.description and sanitized at render time (see
// RichText.tsx) since it's shown to the public on the job board/apply
// page — the editor itself can't produce a <script> tag, but a raw API
// call bypassing it could, so rendering never trusts the stored HTML
// without sanitizing first.
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: placeholder ?? "Write a description…" })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        style: `min-height: 140px; outline: none; font-family: ${theme.typography.fontFamily}; font-size: 0.9375rem; line-height: 1.5;`,
      },
    },
  });

  if (!editor) return null;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ p: 0.75, bgcolor: "action.hover", flexWrap: "wrap" }}>
        <ToggleButton
          value="bold"
          size="small"
          selected={editor.isActive("bold")}
          onChange={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="italic"
          size="small"
          selected={editor.isActive("italic")}
          onChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="heading"
          size="small"
          selected={editor.isActive("heading", { level: 3 })}
          onChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <TitleIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="bulletList"
          size="small"
          selected={editor.isActive("bulletList")}
          onChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FormatListBulletedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          value="orderedList"
          size="small"
          selected={editor.isActive("orderedList")}
          onChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <FormatListNumberedIcon fontSize="small" />
        </ToggleButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <IconButton size="small" onClick={() => editor.chain().focus().undo().run()}>
          <UndoIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => editor.chain().focus().redo().run()}>
          <RedoIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box
        sx={{
          p: 1.5,
          "& .ProseMirror p.is-editor-empty:first-of-type::before": {
            content: "attr(data-placeholder)",
            color: "text.disabled",
            float: "left",
            height: 0,
            pointerEvents: "none",
          },
          "& .ProseMirror ul, & .ProseMirror ol": { pl: 3 },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
