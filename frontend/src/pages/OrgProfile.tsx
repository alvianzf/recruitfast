import { useEffect, useState } from "react";
import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

import { useOrgProfile, useUpdateOrgProfile } from "../api/org";
import { useToast } from "../components/ToastProvider";
import PageHeader from "../components/PageHeader";
import ImageUploadField from "../components/ImageUploadField";

const CURRENCY_OPTIONS = ["IDR", "USD", "SGD", "MYR", "EUR", "GBP", "AUD", "JPY", "INR"];

export default function OrgProfile() {
  const { data: profile } = useOrgProfile();
  const update = useUpdateOrgProfile();
  const { showToast } = useToast();

  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [preferredCurrency, setPreferredCurrency] = useState("IDR");

  useEffect(() => {
    if (!profile) return;
    setLogoUrl(profile.logo_url ?? "");
    setDescription(profile.description ?? "");
    setOfficeLocation(profile.office_location ?? "");
    setContactEmail(profile.contact_email ?? "");
    setPreferredCurrency(profile.preferred_currency);
  }, [profile]);

  async function handleSave() {
    try {
      await update.mutateAsync({
        logo_url: logoUrl.trim() || null,
        description: description.trim() || null,
        office_location: officeLocation.trim() || null,
        contact_email: contactEmail.trim() || null,
        preferred_currency: preferredCurrency,
      });
      showToast("Organization profile updated.");
    } catch {
      showToast("Could not save changes. Please try again.", "error");
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader title="Organization profile" />
      <Typography variant="body2" color="text.secondary">
        Shown on your public career page at {window.location.origin}/jobs/{profile?.slug ?? ""}
      </Typography>

      <Paper sx={{ p: 3.5 }}>
        <Stack spacing={3}>
          <ImageUploadField value={logoUrl} onChange={setLogoUrl} label="Logo" />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <TextField
            label="Office location"
            fullWidth
            value={officeLocation}
            onChange={(e) => setOfficeLocation(e.target.value)}
          />
          <TextField
            label="Contact email"
            type="email"
            fullWidth
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <TextField
            select
            label="Preferred currency"
            fullWidth
            value={preferredCurrency}
            onChange={(e) => setPreferredCurrency(e.target.value)}
            helperText="Placement value and opportunity totals on your dashboard are converted to this currency."
          >
            {CURRENCY_OPTIONS.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Button variant="contained" disabled={update.isPending} onClick={handleSave}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
