import { useMutation } from "@tanstack/react-query";

import { api } from "./client";

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<{ url: string }>("/uploads/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.url;
    },
  });
}
