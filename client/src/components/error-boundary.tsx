import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              An unexpected error occurred in this section. Try refreshing the page.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
              data-testid="button-error-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
