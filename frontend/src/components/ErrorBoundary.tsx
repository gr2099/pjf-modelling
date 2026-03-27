import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Page render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 p-8 text-center">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 max-w-lg w-full text-left">
            <p className="font-semibold text-destructive mb-1">Render error</p>
            <p className="text-sm text-muted-foreground font-mono break-all">
              {this.state.error?.message ?? "Unknown error"}
            </p>
          </div>
          <button
            className="text-sm text-primary underline underline-offset-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
