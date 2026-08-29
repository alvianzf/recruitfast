import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";

export interface FreelanceApplication {
  id: string;
  full_name: string;
  email: string;
  linkedin_url: string | null;
  years_experience: number | null;
  specialization: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export function useFreelanceApplications() {
  return useQuery({
    queryKey: ["freelance-applications"],
    queryFn: async () => (await api.get<FreelanceApplication[]>("/admin/freelance-applications")).data,
  });
}

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  created_at: string;
  // org_admin seats are a separate, uncapped concept — this is
  // recruiter-role seats only. null = unlimited (Custom /pricing tier).
  max_recruiter_seats: number | null;
  active_recruiter_seat_count: number;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  tenant_id: string | null;
  tenant_name: string | null;
  created_at: string;
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => (await api.get<Organization[]>("/admin/organizations")).data,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; admin_full_name: string; admin_email: string; admin_password: string }) =>
      (await api.post<Organization>("/admin/organizations", input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useUpdateOrgSeats(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (maxRecruiterSeats: number | null) =>
      (await api.patch<Organization>(`/admin/organizations/${tenantId}/seats`, { max_recruiter_seats: maxRecruiterSeats })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-organizations"] }),
  });
}

export function useRegisterOrgAdmin(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { full_name: string; email: string; password: string }) =>
      (await api.post<AdminUser>(`/admin/organizations/${tenantId}/admins`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useCreateSuperadmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { full_name: string; email: string; password: string }) =>
      (await api.post<AdminUser>("/admin/superadmins", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get<AdminUser[]>("/admin/users")).data,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status: newStatus }: { id: string; status: string }) =>
      (await api.patch<AdminUser>(`/admin/users/${id}/status`, { status: newStatus })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}
