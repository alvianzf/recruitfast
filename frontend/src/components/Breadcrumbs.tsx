import { Breadcrumbs as MuiBreadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

// See docs/06-ui-design-system.md#navigation-breadcrumbs — only rendered
// below top-level nav destinations, current segment is plain text.
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <MuiBreadcrumbs sx={{ mb: 1 }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        if (isLast || !item.to) {
          return (
            <Typography key={item.label} variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
          );
        }
        return (
          <MuiLink key={item.label} component={RouterLink} to={item.to} underline="hover" variant="body2">
            {item.label}
          </MuiLink>
        );
      })}
    </MuiBreadcrumbs>
  );
}
