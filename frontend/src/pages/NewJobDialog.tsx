import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { isAxiosError } from "axios";

import { useCreateJob } from "../api/jobs";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  overview: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createJob = useCreateJob();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function handleClose() {
    reset();
    createJob.reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    await createJob.mutateAsync(values);
    handleClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New job</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2.5}>
            {createJob.isError && (
              <Alert severity="error">
                {isAxiosError(createJob.error) && createJob.error.response?.data?.detail
                  ? createJob.error.response.data.detail
                  : "Could not create the job. Please try again."}
              </Alert>
            )}
            <TextField
              label="Title"
              autoFocus
              fullWidth
              {...register("title")}
              error={!!errors.title}
              helperText={errors.title?.message}
            />
            <TextField label="Overview" fullWidth {...register("overview")} />
            <TextField label="Description" fullWidth multiline minRows={3} {...register("description")} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={createJob.isPending}>
            {createJob.isPending ? "Creating…" : "Create job"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
