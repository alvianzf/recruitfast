import { useEffect, useState } from "react";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { isAxiosError } from "axios";

import { useMe, useUpdateMe, useChangeMyPassword } from "../api/users";
import { useToast } from "../components/ToastProvider";
import PageHeader from "../components/PageHeader";
import ImageUploadField from "../components/ImageUploadField";

function ProfileDetailsCard() {
  const { data: me } = useMe();
  const update = useUpdateMe();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!me) return;
    setFullName(me.full_name);
    setEmail(me.email);
    setAvatarUrl(me.avatar_url ?? "");
  }, [me]);

  async function handleSave() {
    try {
      await update.mutateAsync({ full_name: fullName.trim(), email: email.trim(), avatar_url: avatarUrl || null });
      showToast("Profile updated.");
    } catch {
      showToast("Could not save changes. Please try again.", "error");
    }
  }

  return (
    <Paper sx={{ p: 3.5 }}>
      <Stack spacing={3}>
        <ImageUploadField value={avatarUrl} onChange={setAvatarUrl} label="Profile picture" />
        <TextField label="Full name" fullWidth value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="Email" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <Button variant="contained" disabled={update.isPending} onClick={handleSave}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ChangePasswordCard() {
  const changePassword = useChangeMyPassword();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    try {
      await changePassword.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password changed.");
    } catch (e) {
      setError(
        isAxiosError(e) && e.response?.data?.detail ? e.response.data.detail : "Could not change your password.",
      );
    }
  }

  return (
    <Paper sx={{ p: 3.5 }}>
      <Typography sx={{ fontWeight: 700, mb: 2 }}>Change password</Typography>
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Current password"
          type="password"
          fullWidth
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextField
          label="New password"
          type="password"
          fullWidth
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          helperText="At least 8 characters."
        />
        <TextField
          label="Confirm new password"
          type="password"
          fullWidth
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            disabled={changePassword.isPending || !currentPassword || !newPassword}
            onClick={handleSave}
          >
            {changePassword.isPending ? "Saving…" : "Change password"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function Profile() {
  return (
    <Stack spacing={3}>
      <PageHeader title="My profile" />
      <ProfileDetailsCard />
      <ChangePasswordCard />
    </Stack>
  );
}
