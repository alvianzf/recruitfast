import { motion } from "framer-motion";
import { Box, Stack, Typography } from "@mui/material";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";

import { paletteColor } from "./vectorPalette";

const STEPS = [
  { Icon: PersonAddAlt1OutlinedIcon, title: "Apply or post", body: "A candidate applies, or a recruiter posts a role, in one shared place.", color: paletteColor(4) },
  { Icon: ViewKanbanOutlinedIcon, title: "Move through a pipeline", body: "Every job gets its own customizable stages, tracked from first contact to offer.", color: paletteColor(0) },
  { Icon: EmojiEventsOutlinedIcon, title: "Hire, and learn from it", body: "Time to hire and stage conversion are tracked automatically, so the process gets faster over time.", color: paletteColor(3) },
];

// Decorative "how it works" journey graphic for the About page: three
// steps connected by a line that draws itself in as it scrolls into
// view, each node scaling in behind it. Each step gets its own palette
// color instead of a single repeated tone. Inline SVG plus framer-motion,
// same technique as the landing page's CandidateNetworkGraphic.
export default function AboutJourneyGraphic() {
  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ display: { xs: "none", md: "block" }, position: "absolute", top: 28, left: "16.5%", right: "16.5%", height: 2 }}>
        <svg width="100%" height="2" viewBox="0 0 100 2" preserveAspectRatio="none">
          <defs>
            <linearGradient id="journeyLineGradient" x1="0" y1="0" x2="1" y2="0">
              {STEPS.map((step, i) => (
                <stop key={step.title} offset={`${(i / (STEPS.length - 1)) * 100}%`} stopColor={step.color} />
              ))}
            </linearGradient>
          </defs>
          <motion.line
            x1="0"
            y1="1"
            x2="100"
            y2="1"
            stroke="url(#journeyLineGradient)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
      </Box>

      <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 4, md: 3 }}>
        {STEPS.map((step, i) => (
          <Stack key={step.title} spacing={1.5} sx={{ flex: 1, textAlign: "center", alignItems: "center" }}>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.3, ease: "backOut" }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: step.color,
                  boxShadow: `0 8px 20px ${step.color}59`,
                }}
              >
                <step.Icon sx={{ color: "#ffffff", fontSize: 26 }} />
              </Box>
            </motion.div>
            <Typography sx={{ fontWeight: 700, color: "#ffffff" }}>{step.title}</Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)", maxWidth: 260 }}>
              {step.body}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
