import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Mail, Chrome } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { login, register, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const result = await login(loginEmail, loginPassword);
    setLoginLoading(false);
    if (result.error) {
      toast({ title: "Sign in failed", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!" });
      onOpenChange(false);
      setLoginEmail("");
      setLoginPassword("");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setRegLoading(true);
    const result = await register(regName, regEmail, regPassword);
    setRegLoading(false);
    if (result.error) {
      toast({ title: "Registration failed", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Account created!", description: result.message || "Check your email to verify your account." });
      onOpenChange(false);
      setRegName("");
      setRegEmail("");
      setRegPassword("");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      toast({ title: "Check your email", description: data.message });
      setShowForgotPassword(false);
      setForgotEmail("");
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
    setForgotLoading(false);
  };

  if (showForgotPassword) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="your@email.com"
                required
                data-testid="input-forgot-email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={forgotLoading} data-testid="button-send-reset">
              {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Reset Link
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotPassword(false)} data-testid="button-back-to-signin">
              Back to Sign In
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to xtrawordinary</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  data-testid="input-login-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  data-testid="input-login-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading} data-testid="button-signin">
                {loginLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Sign In
              </Button>
              <Button type="button" variant="link" className="w-full text-sm" onClick={() => setShowForgotPassword(true)} data-testid="button-forgot-password">
                Forgot your password?
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name">Name</Label>
                <Input
                  id="reg-name"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Your name"
                  required
                  data-testid="input-reg-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  data-testid="input-reg-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  data-testid="input-reg-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={regLoading} data-testid="button-signup">
                {regLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={loginWithGoogle} data-testid="button-google-signin">
          <Chrome className="h-4 w-4 mr-2" />
          Continue with Google
        </Button>
      </DialogContent>
    </Dialog>
  );
}
