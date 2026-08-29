import { motion } from "framer-motion";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { PUBLIC_BLUE_BACKGROUND, PUBLIC_GLASS_SX } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import FaqOrbitGraphic from "./FaqOrbitGraphic";

const SECTIONS = [
  {
    icon: PersonSearchOutlinedIcon,
    title: "For job seekers",
    items: [
      {
        q: "Do I need to create an account to apply?",
        a: "No. Applying to a job is public: fill in the form, upload your CV, and submit. There is no password to remember.",
      },
      {
        q: "What does \"open for other roles\" actually do?",
        a: "Checking that box on the application form adds you to the Open Profiles pool, visible to every recruiter on the platform, not just the organization you applied to. One CV, considered for more than one job.",
      },
      {
        q: "Can any recruiter see my full application history?",
        a: "No. Only the organization you applied to sees your application and answers. Open Profiles shares just your name, current position, and years of experience with other recruiters, until one of them chooses to attach you to their own job.",
      },
      {
        q: "Will I be notified if a recruiter blacklists me?",
        a: "Blacklisting is a warning flag tied to an email address, shared across the platform if you apply again elsewhere. It does not expose who added the flag, only the reason they stated.",
      },
    ],
  },
  {
    icon: WorkOutlinedIcon,
    title: "For recruiters and agencies",
    items: [
      {
        q: "What is a pipeline, and can I change it?",
        a: "Every job gets its own set of hiring stages, for example Sourced, Interview, Offer, and Signed. You can add, rename, reorder, or delete stages per job, since not every role needs the same process.",
      },
      {
        q: "Can I claim a job that is not assigned to me?",
        a: "If an org admin leaves a job unassigned, any recruiter in the organization can self-claim it instead of waiting for a manual handoff.",
      },
      {
        q: "How do I reuse a candidate I already reviewed?",
        a: "Find Candidates searches your organization's candidates plus every open profile platform-wide by technical skill, years of experience, and how recently that skill was used, then lets you attach a match straight to a new job.",
      },
      {
        q: "Can I keep a job's salary private?",
        a: "Yes. Mark a job's salary as confidential and it never appears on the public job board, while recruiters inside your organization can still see it.",
      },
      {
        q: "What happens when a candidate reaches Signed?",
        a: "Reaching a job's Signed stage counts toward headcount and can automatically close the job to Won once it is filled. It also prompts you to record the starting date and offer rate for that placement.",
      },
    ],
  },
  {
    icon: ShieldOutlinedIcon,
    title: "Platform and privacy",
    items: [
      {
        q: "Is data shared between organizations by default?",
        a: "No. Confidentiality is enforced with row level security at the database layer, not just hidden in the interface. An organization's candidates and jobs stay private unless a candidate explicitly opts in to Open Profiles.",
      },
      {
        q: "What powers CV parsing?",
        a: "Rule based extraction for structured resumes today, with a self hosted small language model planned for messier free text resumes, so candidate data is never sent to a third party API.",
      },
      {
        q: "Who can see platform wide metrics?",
        a: "Only superadmins see platform wide numbers such as total organizations and pending approvals. Org admins see their own organization's dashboards, and recruiters see their own.",
      },
    ],
  },
];

export default function FAQ() {
  useDocumentMeta(
    "FAQ: FastRecruit",
    "Answers for job seekers, recruiters, and agencies: how Open Profiles work, how confidentiality is enforced, and what powers CV parsing.",
  );
  return (
    <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND }}>
      <PublicNav />

      <Container maxWidth="sm" sx={{ pt: { xs: 6, md: 8 }, pb: 2, textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <FaqOrbitGraphic />
          <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 48 }, color: "#ffffff", mt: 3 }}>
            Frequently asked questions
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, mt: 2, color: "rgba(255,255,255,0.78)" }}>
            Straight answers, grouped by who is asking.
          </Typography>
        </motion.div>
      </Container>

      <Container maxWidth="md" sx={{ pb: { xs: 10, md: 16 } }}>
        <Stack spacing={5} sx={{ mt: 4 }}>
          {SECTIONS.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: sectionIndex * 0.08, ease: "easeOut" }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "secondary.main",
                    color: "#ffffff",
                  }}
                >
                  <section.icon fontSize="small" />
                </Box>
                <Typography variant="h5" sx={{ color: "#ffffff", fontWeight: 700 }}>
                  {section.title}
                </Typography>
              </Stack>

              <Stack spacing={1.5}>
                {section.items.map((item) => (
                  <Accordion
                    key={item.q}
                    disableGutters
                    sx={[
                      { "&:before": { display: "none" }, borderRadius: "12px !important", overflow: "hidden" },
                      PUBLIC_GLASS_SX,
                    ]}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "#ffffff" }} />}>
                      <Typography sx={{ color: "#ffffff", fontWeight: 600 }}>{item.q}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography sx={{ color: "rgba(255,255,255,0.78)" }}>{item.a}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </motion.div>
          ))}
        </Stack>
      </Container>

      <PublicFooter />
    </Box>
  );
}
