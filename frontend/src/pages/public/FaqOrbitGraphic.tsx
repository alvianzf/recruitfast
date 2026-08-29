import { motion } from "framer-motion";
import { Box } from "@mui/material";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

import { paletteColor } from "./vectorPalette";

// Decorative header graphic for the FAQ page: a center "answers" node
// with three satellite icons (speed, collaboration, trust) orbiting
// continuously. Counter-rotated so each icon stays upright while the
// group itself spins, all inline SVG plus framer-motion like the
// landing page's CandidateNetworkGraphic, no external asset needed. Each
// satellite gets its own palette color rather than a single repeated
// tone, to read as vibrant rather than monotone.
const SATELLITES = [
  { Icon: BoltOutlinedIcon, angle: -90, color: paletteColor(4) },
  { Icon: GroupsOutlinedIcon, angle: 30, color: paletteColor(1) },
  { Icon: ShieldOutlinedIcon, angle: 150, color: paletteColor(2) },
];

export default function FaqOrbitGraphic() {
  const radius = 90;

  return (
    <Box sx={{ position: "relative", width: 240, height: 240, mx: "auto" }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", inset: 0 }}
      >
        {SATELLITES.map(({ Icon, angle, color }, i) => {
          const rad = (angle * Math.PI) / 180;
          const x = 120 + radius * Math.cos(rad);
          const y = 120 + radius * Math.sin(rad);
          return (
            <motion.div
              key={i}
              animate={{ rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute",
                left: x - 22,
                top: y - 22,
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                border: `2px solid ${color}`,
              }}
            >
              <Icon sx={{ color, fontSize: 22 }} />
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "backOut" }}
        style={{
          position: "absolute",
          left: 60,
          top: 60,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #D1653A, #A84D28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(209,101,58,0.35)",
        }}
      >
        <Box sx={{ color: "#ffffff", fontWeight: 800, fontSize: 44, fontFamily: "var(--font-display, inherit)" }}>?</Box>
      </motion.div>
    </Box>
  );
}
