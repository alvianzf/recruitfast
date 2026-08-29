import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
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
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";

import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { PUBLIC_BLUE_BACKGROUND, PUBLIC_GLASS_SX, publicOutlinedButtonSx } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";

const TIERS = [
  {
    name: "Freelance Recruiter",
    price: "IDR 35,000",
    period: "/month",
    seats: "1 recruiter seat",
    extraSeatNote: undefined as string | undefined,
    description: "For independent recruiters working their own desk.",
    features: [
      "Unlimited job postings",
      "Full candidate pipeline & Kanban board",
      "CV parsing on upload",
      "Open Profiles — get discovered platform-wide by other recruiters",
      "Personal dashboard & placement metrics",
      "Listed on the public job board",
    ],
    cta: { kind: "internal" as const, label: "Get started", to: "/register" },
    highlighted: false,
  },
  {
    name: "Organization",
    price: "IDR 100,000",
    period: "/month",
    seats: "1 admin seat + 3 recruiter seats included",
    extraSeatNote: "Additional recruiter seats: IDR 25,000/month each",
    description: "For agencies and in-house teams hiring together.",
    features: [
      "Everything in Freelance Recruiter",
      "1 admin seat + 3 recruiter seats included",
      "Team-wide candidate & job visibility",
      "Org branding — logo and a public org job page",
      "Recruiter management & admin overrides",
      "Multi-currency placement value tracking",
      "Client roster with per-client revenue & metrics",
      "Org-wide dashboard & pipeline breakdown",
    ],
    cta: { kind: "external" as const, label: "Talk to us", href: "mailto:hello@alvianzf.id" },
    highlighted: true,
  },
  {
    name: "Custom",
    price: "Custom",
    period: "",
    seats: "As many seats as you need",
    extraSeatNote: undefined as string | undefined,
    description: "For larger agencies and enterprises with requirements the standard tiers don't cover.",
    features: [
      "Everything in Organization",
      "Unlimited recruiter seats",
      "Custom billing & invoicing terms",
      "Priority support & onboarding",
      "Dedicated account contact",
    ],
    cta: { kind: "external" as const, label: "Talk to us", href: "mailto:hello@alvianzf.id" },
    highlighted: false,
  },
];

// One row per distinct capability across all three tiers — grounded in
// what each tier's card actually lists (or, for shared baseline
// features like multi-currency conversion, in what's genuinely
// available to that tenant type server-side), not just repeating each
// card's own feature copy verbatim.
const FEATURE_MATRIX: { feature: string; freelance: boolean; organization: boolean; custom: boolean }[] = [
  { feature: "Unlimited job postings", freelance: true, organization: true, custom: true },
  { feature: "Full candidate pipeline & Kanban board", freelance: true, organization: true, custom: true },
  { feature: "CV parsing on upload", freelance: true, organization: true, custom: true },
  { feature: "Open Profiles — platform-wide discovery", freelance: true, organization: true, custom: true },
  { feature: "Dashboard & placement value metrics", freelance: true, organization: true, custom: true },
  { feature: "Multi-currency placement value tracking", freelance: true, organization: true, custom: true },
  { feature: "Listed on the public job board", freelance: true, organization: true, custom: true },
  { feature: "Team-wide candidate & job visibility", freelance: false, organization: true, custom: true },
  { feature: "Org branding — logo & public org job page", freelance: false, organization: true, custom: true },
  { feature: "Recruiter management & admin overrides", freelance: false, organization: true, custom: true },
  { feature: "Client roster with per-client revenue & metrics", freelance: false, organization: true, custom: true },
  { feature: "Org-wide dashboard & pipeline breakdown", freelance: false, organization: true, custom: true },
  { feature: "Unlimited recruiter seats", freelance: false, organization: false, custom: true },
  { feature: "Custom billing & invoicing terms", freelance: false, organization: false, custom: true },
  { feature: "Priority support & onboarding", freelance: false, organization: false, custom: true },
  { feature: "Dedicated account contact", freelance: false, organization: false, custom: true },
];

function FeatureCell({ included }: { included: boolean }) {
  return included ? (
    <CheckCircleOutlinedIcon fontSize="small" sx={{ color: "secondary.main" }} />
  ) : (
    <CloseIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.25)" }} />
  );
}

export default function Pricing() {
  useDocumentMeta(
    "Pricing: FastRecruit",
    "Simple, seat-based pricing for freelance recruiters and organizations. IDR 35,000/month for a freelance recruiter, IDR 100,000/month for an organization with 3 recruiter seats and 1 admin included.",
  );
  return (
    <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND }}>
      <PublicNav />

      <Container maxWidth="md" sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 6, md: 8 }, textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <Typography variant="h1" sx={{ fontSize: { xs: 36, md: 56 }, color: "#ffffff" }}>
            Simple pricing, built for how you{" "}
            <Box component="span" sx={{ color: "secondary.main" }}>
              hire
            </Box>
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, mt: 3, maxWidth: 640, mx: "auto", color: "rgba(255,255,255,0.78)" }}>
            One plan for independent recruiters, one for teams. No per-application fees, no hidden seat charges.
          </Typography>
        </motion.div>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Grid container spacing={4}>
          {TIERS.map((tier, i) => (
            <Grid key={tier.name} size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                style={{ height: "100%" }}
              >
                <Paper
                  sx={[
                    { p: { xs: 4, md: 5 }, height: "100%", display: "flex", flexDirection: "column" },
                    PUBLIC_GLASS_SX,
                    tier.highlighted ? { border: "1px solid rgba(209, 101, 58, 0.6)" } : {},
                  ]}
                  elevation={0}
                >
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Typography variant="h5" sx={{ color: "#ffffff", fontWeight: 800 }}>
                      {tier.name}
                    </Typography>
                    {tier.highlighted && <Chip label="For Agencies or Teams" color="secondary" size="small" />}
                  </Stack>
                  <Typography sx={{ color: "rgba(255,255,255,0.72)", mb: 3 }}>{tier.description}</Typography>

                  <Stack direction="row" sx={{ alignItems: "baseline", gap: 0.75, mb: 0.5 }}>
                    <Typography variant="h3" sx={{ color: "#ffffff", fontWeight: 800 }}>
                      {tier.price}
                    </Typography>
                    {tier.period && <Typography sx={{ color: "rgba(255,255,255,0.6)" }}>{tier.period}</Typography>}
                  </Stack>
                  <Typography variant="body2" sx={{ color: "secondary.main", fontWeight: 600 }}>
                    {tier.seats}
                  </Typography>
                  {tier.extraSeatNote && (
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", mb: 3, display: "block" }}>
                      {tier.extraSeatNote}
                    </Typography>
                  )}
                  {!tier.extraSeatNote && <Box sx={{ mb: 3 }} />}

                  <Stack spacing={1.25} sx={{ mb: 4, flexGrow: 1 }}>
                    {tier.features.map((feature) => (
                      <Stack key={feature} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                        <CheckCircleOutlinedIcon fontSize="small" sx={{ color: "secondary.main", mt: 0.25, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
                          {feature}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>

                  {tier.cta.kind === "internal" ? (
                    <Button component={RouterLink} to={tier.cta.to} variant="contained" color="secondary" size="large" fullWidth>
                      {tier.cta.label}
                    </Button>
                  ) : (
                    <Button component="a" href={tier.cta.href} variant="outlined" size="large" fullWidth sx={publicOutlinedButtonSx}>
                      {tier.cta.label}
                    </Button>
                  )}
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", textAlign: "center", mt: 5 }}>
          Registration is open and free while billing is being rolled out — no card required to get started today.
        </Typography>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Typography variant="h4" sx={{ color: "#ffffff", fontWeight: 800, textAlign: "center", mb: 5 }}>
          Compare plans
        </Typography>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, ease: "easeOut" }}>
          <Paper sx={[{ overflow: "hidden" }, PUBLIC_GLASS_SX]} elevation={0}>
            {/* This table is genuinely wider than a phone viewport — scope
                the horizontal scroll to the table itself, never the page. */}
            <Box sx={{ overflowX: "auto" }}>
              <TableContainer>
                <Table sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.12)" }}>Feature</TableCell>
                      {TIERS.map((tier) => (
                        <TableCell key={tier.name} align="center" sx={{ color: "#ffffff", fontWeight: 700, borderColor: "rgba(255,255,255,0.12)" }}>
                          {tier.name}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {FEATURE_MATRIX.map((row) => (
                      <TableRow key={row.feature}>
                        <TableCell sx={{ color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.08)" }}>
                          {row.feature}
                        </TableCell>
                        <TableCell align="center" sx={{ borderColor: "rgba(255,255,255,0.08)" }}>
                          <FeatureCell included={row.freelance} />
                        </TableCell>
                        <TableCell align="center" sx={{ borderColor: "rgba(255,255,255,0.08)" }}>
                          <FeatureCell included={row.organization} />
                        </TableCell>
                        <TableCell align="center" sx={{ borderColor: "rgba(255,255,255,0.08)" }}>
                          <FeatureCell included={row.custom} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>
        </motion.div>
      </Container>

      <PublicFooter />
    </Box>
  );
}
