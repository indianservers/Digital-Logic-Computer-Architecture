import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || "Something went wrong in this lab." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LogicLab studio error", error, info.componentStack);
  }

  render() {
    if (this.state.message) {
      return (
        <section className="card">
          <h3>This lab hit an error</h3>
          <p className="muted">{this.state.message}</p>
          <div className="row">
            <button className="btn-primary" onClick={() => this.setState({ message: null })}>Try again</button>
            <Link className="btn-ghost" to="/">Back to Path</Link>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
