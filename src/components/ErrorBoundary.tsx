import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Error Boundary (bug 2.5): prevents React crashes from taking down the entire app.
 *  Wraps the main App to catch rendering errors and show a graceful fallback.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #F0EDE8, #F5F2EE)",
          padding: 24,
        }}>
          <div style={{
            maxWidth: 480,
            textAlign: "center",
            background: "rgba(255,255,255,0.9)",
            borderRadius: 16,
            padding: "40px 32px",
            border: "1px solid #E8E4DE",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#3D3832", margin: "0 0 8px" }}>
              页面出错了
            </h2>
            <p style={{ fontSize: 14, color: "#625C54", lineHeight: 1.6, margin: "0 0 20px" }}>
              抱歉，遇到了意外错误。请刷新页面重试。
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                marginTop: 20,
                padding: "10px 24px",
                background: "linear-gradient(135deg, #675A4D, #A69888)",
                color: "#FFF",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
