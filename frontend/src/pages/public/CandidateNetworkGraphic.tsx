import { motion } from "framer-motion";
import { Box } from "@mui/material";

import { paletteColor } from "./vectorPalette";

// Purely decorative vector illustration for the "job seeker" section of
// the landing page: one CV (center) fanning out to many recruiter nodes,
// animated to read as "fast" (flowing connector lines) and "collaborative"
// (multiple nodes lighting up together, not one at a time). Each node and
// line gets its own hue from the shared palette rather than one repeated
// accent color, so the graphic reads as vibrant, not monotone. Inline SVG
// plus framer-motion, no external asset/icon-pack dependency.
const NODES = [
  { x: 340, y: 55 },
  { x: 380, y: 150 },
  { x: 340, y: 245 },
  { x: 60, y: 245 },
  { x: 20, y: 150 },
  { x: 60, y: 55 },
];

export default function CandidateNetworkGraphic() {
  const center = { x: 200, y: 150 };

  return (
    <Box>
      <motion.svg
        viewBox="0 0 400 300"
        width="100%"
        height="auto"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <defs>
          {NODES.map((_, i) => (
            <linearGradient key={`grad-${i}`} id={`cnLineGradient-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={paletteColor(i)} stopOpacity="0.9" />
              <stop offset="100%" stopColor={paletteColor(i)} stopOpacity="0.15" />
            </linearGradient>
          ))}
        </defs>

        {NODES.map((node, i) => (
          <motion.line
            key={`line-${i}`}
            x1={center.x}
            y1={center.y}
            x2={node.x}
            y2={node.y}
            stroke={`url(#cnLineGradient-${i})`}
            strokeWidth={2}
            strokeLinecap="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              show: {
                pathLength: 1,
                opacity: 1,
                transition: { duration: 0.6, delay: 0.15 * i, ease: "easeOut" },
              },
            }}
          />
        ))}

        {NODES.map((node, i) => (
          <motion.g
            key={`node-${i}`}
            variants={{
              hidden: { opacity: 0, scale: 0 },
              show: {
                opacity: 1,
                scale: 1,
                transition: { duration: 0.4, delay: 0.15 * i + 0.4, ease: "backOut" },
              },
            }}
            style={{ transformOrigin: `${node.x}px ${node.y}px` }}
          >
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={16}
              fill="#ffffff"
              opacity={0.95}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            />
            <circle cx={node.x} cy={node.y} r={16} fill="none" stroke={paletteColor(i)} strokeWidth={2} opacity={0.8} />
            <circle cx={node.x} cy={node.y} r={5} fill={paletteColor(i)} />
          </motion.g>
        ))}

        <motion.circle
          cx={center.x}
          cy={center.y}
          r={34}
          fill="#ffffff"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "backOut" }}
        />
        <g>
          <rect x={center.x - 14} y={center.y - 18} width={28} height={36} rx={3} fill="none" stroke="#3D6B94" strokeWidth={2} />
          <line x1={center.x - 8} y1={center.y - 9} x2={center.x + 8} y2={center.y - 9} stroke="#3D6B94" strokeWidth={2} strokeLinecap="round" />
          <line x1={center.x - 8} y1={center.y - 2} x2={center.x + 8} y2={center.y - 2} stroke="#3D6B94" strokeWidth={2} strokeLinecap="round" />
          <line x1={center.x - 8} y1={center.y + 5} x2={center.x + 3} y2={center.y + 5} stroke="#3D6B94" strokeWidth={2} strokeLinecap="round" />
        </g>
      </motion.svg>
    </Box>
  );
}
