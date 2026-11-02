import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

function uploadAvatarFile(
  file: File,
  onProgress: (progress: number | null) => void,
  onRequestCreated: (request: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    onRequestCreated(request);
    request.open("POST", "/api/users/me/avatar");
    request.withCredentials = true;
    request.setRequestHeader("Content-Type", file.type);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        onProgress(null);
        return;
      }

      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      let message = "Failed to upload avatar";
      try {
        const payload = JSON.parse(request.responseText);
        message = payload?.error || message;
      } catch {
        // Keep the generic message when the server response is not JSON.
      }
      reject(new Error(message));
    });
    request.addEventListener("error", () => {
      reject(new Error("Network error while uploading avatar"));
    });
    request.addEventListener("abort", () => {
      const error = new Error("Avatar upload was cancelled");
      error.name = "AbortError";
      reject(error);
    });
    request.send(file);
  });
}

export function useAvatarUpload(userId: number) {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null);
  const activeRequestRef = useRef<XMLHttpRequest | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      try {
        await uploadAvatarFile(file, setAvatarUploadProgress, (request) => {
          activeRequestRef.current = request;
        });
      } finally {
        activeRequestRef.current = null;
      }
    },
    onMutate: () => setAvatarUploadProgress(null),
    onSuccess: async () => {
      toast({ title: "Avatar updated" });
      await refreshUser();
      await queryClient.invalidateQueries({
        queryKey: ["/api/users", userId, "profile"],
      });
    },
    onError: (error: Error) => {
      if (error.name === "AbortError") return;
      toast({
        title: "Avatar upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setAvatarUploadProgress(null),
  });

  function cancelAvatarUpload() {
    activeRequestRef.current?.abort();
  }

  return {
    uploadAvatar: upload.mutateAsync,
    cancelAvatarUpload,
    isUploadingAvatar: upload.isPending,
    avatarUploadProgress,
  };
}
