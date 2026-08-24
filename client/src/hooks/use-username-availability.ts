import { useEffect, useState } from "react";

type UsernameAvailability = {
  checking: boolean;
  available: boolean | null;
  message: string | null;
};

export function useUsernameAvailability(username: string): UsernameAvailability {
  const [state, setState] = useState<UsernameAvailability>({
    checking: false,
    available: null,
    message: null,
  });

  useEffect(() => {
    const value = username.trim();
    if (!value) {
      setState({ checking: false, available: null, message: null });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setState({ checking: true, available: null, message: null });
      try {
        const res = await fetch(`/api/users/username-available?username=${encodeURIComponent(value)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!cancelled) {
          setState({
            checking: false,
            available: Boolean(data.available),
            message: data.error ?? (data.available ? "Username available" : "That username is already taken"),
          });
        }
      } catch {
        if (!cancelled) setState({ checking: false, available: null, message: "Couldn't check username availability" });
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username]);

  return state;
}