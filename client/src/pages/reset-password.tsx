import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"form" | "loading" | "success" | "error">("form");
  const [message, setMessage] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground">No reset token provided.</p>
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home">Go to xtraWordinary</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setStatus("error");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Password reset successfully!");
      } else {
        setStatus("error");
        setMessage(data.error || "Reset failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4">
          {status === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-center">Reset Your Password</h2>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-reset-password">
                Reset Password
              </Button>
            </form>
          )}
          {status === "loading" && (
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground mt-4">Resetting password...</p>
            </div>
          )}
          {status === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h2 className="text-xl font-bold" data-testid="text-reset-success">Password Reset!</h2>
              <p className="text-muted-foreground">{message}</p>
              <Link href="/">
                <Button data-testid="button-go-home">Go to xtraWordinary</Button>
              </Link>
            </div>
          )}
          {status === "error" && (
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-xl font-bold" data-testid="text-reset-error">Reset Failed</h2>
              <p className="text-muted-foreground">{message}</p>
              <Button variant="outline" onClick={() => setStatus("form")} data-testid="button-try-again">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
