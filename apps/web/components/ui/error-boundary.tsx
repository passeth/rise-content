"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[200px]">
          <p className="text-sm font-medium text-destructive">
            오류가 발생했습니다
          </p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground max-w-xs">
              {this.state.error.message}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
