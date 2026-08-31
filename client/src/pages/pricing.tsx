import { PageSEO } from "@/components/page-seo";
import { Check, Minus, GraduationCap, School, Users, User, ChevronDown, ChevronUp, Crown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const individualFeatures = [
  "Unlimited plays across all games",
  "Appear on the global leaderboard",
  "Advanced stats & score history",
  "Streak shields (2 per month)",
  "Ad-free experience",
  "Zen mode — no timers on timed games",
  "Early access to new games",
  "Create unlimited groups",
  "Unlimited friend challenges",
  "Full profile customisation",
  "Custom Play — configure your own game variants",
  "Quiz Master — create & host shareable quiz sessions",
];

const familyExtras = [
  "Up to 5 profiles under one account",
  "Child-safe profiles with age-appropriate word lists",
  "Timers off by default for younger players",
  "No social features on child profiles (safe by default)",
  "Parent dashboard — track every profile's progress",
];

const comparisonRows: { feature: string; individual: boolean; family: boolean }[] = [
  { feature: "Unlimited plays", individual: true, family: true },
  { feature: "Global leaderboard presence", individual: true, family: true },
  { feature: "Advanced stats & history", individual: true, family: true },
  { feature: "Streak shields (2/month)", individual: true, family: true },
  { feature: "Ad-free", individual: true, family: true },
  { feature: "Zen mode (no timers)", individual: true, family: true },
  { feature: "Early access to new games", individual: true, family: true },
  { feature: "Create unlimited groups", individual: true, family: true },
  { feature: "Unlimited friend challenges", individual: true, family: true },
  { feature: "Full profile customisation", individual: true, family: true },
  { feature: "Custom Play (5 configurable games)", individual: true, family: true },
  { feature: "Quiz Master — create & host quizzes", individual: true, family: true },
  { feature: "Up to 5 profiles", individual: false, family: true },
  { feature: "Child-safe profiles", individual: false, family: true },
  { feature: "Age-appropriate word lists", individual: false, family: true },
  { feature: "Parent dashboard", individual: false, family: true },
];

const faqs = [
  {
    q: "Can I cancel at any time?",
    a: "Yes. You can cancel your subscription at any time from your account settings. You'll keep access until the end of your current billing period.",
  },
  {
    q: "What happens to my stats and progress if I cancel?",
    a: "Your account, stats, achievements, and game history are always yours. Cancelling simply returns you to the free experience — nothing is deleted.",
  },
  {
    q: "Does the Family plan count as multiple accounts?",
    a: "No — the Family plan is one subscription billed to one account. Child profiles live under the parent account and do not have their own logins.",
  },
  {
    q: "Is the daily challenge always free?",
    a: "Yes, always. The daily challenge is the heart of xtraWordinary and will never be locked behind a paywall.",
  },
  {
    q: "Do you offer a free trial?",
    a: "We're working on it. Check back soon — we plan to offer a trial period before charging.",
  },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { toast } = useToast();

  const isPremium = isAuthenticated && user?.isPremium;

  async function handleActivate() {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setUpgrading(true);
    try {
      await apiRequest("POST", "/api/users/me/upgrade-premium");
      await refreshUser();
      toast({ title: "You're now Premium!", description: "All premium features are now unlocked." });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  }

  const activateButton = (
    <Button
      className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
      size="lg"
      onClick={handleActivate}
      disabled={upgrading || isPremium}
      data-testid="button-activate-premium"
    >
      <Crown className="h-4 w-4" />
      {isPremium
        ? "Already active"
        : upgrading
        ? "Activating…"
        : isAuthenticated
        ? "Activate — free while in beta"
        : "Sign in to activate"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageSEO title="Premium Pricing" description="Unlock Premium features on xtraWordinary — custom game modes, exclusive stats, and more." path="/pricing" />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />

      {/* Hero */}
      <section className="pt-16 pb-10 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <Badge variant="secondary" className="mb-4 text-xs font-medium tracking-wide uppercase">
            Membership
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            Unlock the full experience
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            All 24 games are free to try. Upgrade to play without limits, climb the leaderboard, and get every feature we build.
          </p>
          {isPremium && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <Crown className="h-4 w-4" />
              You already have Premium — enjoy every feature!
            </div>
          )}
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Individual */}
          <div className="relative rounded-2xl border border-border bg-card p-8 flex flex-col" data-testid="card-plan-individual">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Individual</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Everything you need to play seriously and compete.</p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">$3</span>
              <span className="text-muted-foreground ml-1">/ month</span>
            </div>

            {/* <div className="mb-8">{activateButton}</div> */}

            <ul className="space-y-3 flex-1">
              {individualFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Family */}
          <div className="relative rounded-2xl border-2 border-primary bg-card p-8 flex flex-col shadow-lg" data-testid="card-plan-family">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 shadow">
                Best Value
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Family</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">One plan for the whole household. Up to 5 profiles.</p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">$8</span>
              <span className="text-muted-foreground ml-1">/ month</span>
            </div>

            {/* <div className="mb-8">{activateButton}</div> */}

            <ul className="space-y-3 flex-1">
              <li className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Everything in Individual, plus:</li>
              {familyExtras.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Beta notice */}
        <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto">
          Payments are not yet active. Both plans grant the same full Premium access while we're in beta. Pricing will be enforced once billing is live.
        </p>
      </section>

      {/* Comparison table */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">Full feature comparison</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm" data-testid="table-feature-comparison">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Feature</th>
                  <th className="text-center px-6 py-4 font-semibold text-foreground w-28">Individual</th>
                  <th className="text-center px-6 py-4 font-semibold text-primary w-28">Family</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                  >
                    <td className="px-6 py-3 text-foreground">{row.feature}</td>
                    <td className="px-6 py-3 text-center">
                      {row.individual ? (
                        <Check className="h-4 w-4 text-accent mx-auto" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {row.family ? (
                        <Check className="h-4 w-4 text-accent mx-auto" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Educators section */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
            <div className="px-8 pt-8 pb-6 border-b border-border">
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">For Educators</h2>
              </div>
              <p className="text-muted-foreground max-w-xl">
                xtraWordinary is built around the same mechanics that make vocabulary learning stick — repetition, competition, and immediate feedback. Bring it to your classroom or school.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {/* Teacher plan */}
              <div className="p-8" data-testid="card-plan-teacher">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Teacher Plan</h3>
                    {/* <p className="text-xs text-muted-foreground">~$10–15 / month per teacher</p> */}
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-foreground mb-6">
                  {[
                    "Create a private classroom with a student join code",
                    "Assign games as homework with a closing deadline",
                    "Per-student performance dashboard",
                    "Track vocabulary progress over time",
                    "Force specific game modes and difficulty settings",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" data-testid="button-contact-teacher">
                  Contact us
                </Button>
              </div>

              {/* School license */}
              <div className="p-8" data-testid="card-plan-school">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <School className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">School License</h3>
                    {/* <p className="text-xs text-muted-foreground">~$500–2,000 / year per school</p> */}
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-foreground mb-6">
                  {[
                    "Covers all teachers and students at the school",
                    "School-level admin dashboard",
                    "Roster management (CSV import or Google Classroom)",
                    "Progress reports exportable for parents and admin",
                    "Custom branding — school name and logo",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" data-testid="button-contact-school">
                  Contact us
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">Frequently asked questions</h2>
          <div className="space-y-2" data-testid="section-faq">
            {faqs.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  data-testid={`button-faq-${i}`}
                >
                  <span>{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground border-t border-border pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
