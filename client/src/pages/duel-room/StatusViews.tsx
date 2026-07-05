import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, WifiOff } from "lucide-react";

export function ConnectingView() {
  return (
    <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Connecting to duel room…</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DuelErrorView({ errorMsg }: { errorMsg: string }) {
  return (
    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card className="border-destructive">
        <CardContent className="py-12 text-center space-y-4">
          <WifiOff className="h-12 w-12 mx-auto text-destructive" />
          <p className="font-semibold text-destructive">{errorMsg || "Connection failed"}</p>
          <Link href="/friends">
            <Button variant="outline">Go to Friends</Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ReconnectBanner() {
  return (
    <motion.div
      key="reconnect-banner"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 flex items-center gap-2.5 text-amber-700 dark:text-amber-300"
      data-testid="banner-opponent-disconnected"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">Opponent disconnected — waiting for them to reconnect…</span>
    </motion.div>
  );
}
