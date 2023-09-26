import React from 'react';


class ErrorBoundary extends React.Component {
  state = { hasError: false };

  componentDidCatch(error: unknown) {
    // report the error to your favorite Error Tracking tool (ex: Sentry, Bugsnag)
    console.error(error);
  }

  static getDerivedStateFromError(error: unknown) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (<p className="mt-1.5 text-sm text-red-500" id="input-error">
        Failed to load the component
      </p>)
    }

    return this.props.children;
  }
}
