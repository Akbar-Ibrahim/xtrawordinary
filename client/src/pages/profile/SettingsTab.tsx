import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell, ChevronRight, Trash2 } from "lucide-react";

interface Props {
  onDeleteAccount: () => void;
}

export function SettingsTab({ onDeleteAccount }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Notification Preferences</h3>
        <p className="text-xs text-muted-foreground mb-2">Choose which in-app notifications you receive.</p>
      </div>
      <Link href="/settings/notifications">
        <Button variant="outline" className="w-full justify-between" data-testid="link-manage-notifications">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Manage Notification Preferences
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      </Link>
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold text-sm mb-1 text-destructive">Danger Zone</h3>
        <p className="text-xs text-muted-foreground mb-3">Permanently delete your account and all associated data. This cannot be undone.</p>
        <Button variant="destructive" size="sm" onClick={onDeleteAccount} data-testid="button-delete-account">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete My Account
        </Button>
      </div>
    </div>
  );
}
