import React from 'react'
import ReactDOM from 'react-dom/client'
import IOWNDashboard from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("App crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", {
        style: { minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: "#0C1018", color: "#EBF0E1", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }
      },
        React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "⚠️"),
        React.createElement("div", { style: { fontSize: 20, fontWeight: 700, marginBottom: 8 } }, "Something went wrong"),
        React.createElement("div", { style: { fontSize: 13, color: "#8A9178", marginBottom: 24, maxWidth: 360 } },
          String(this.state.error?.message || "An unexpected error occurred")),
        React.createElement("button", {
          onClick: () => { this.setState({ hasError: false, error: null }); },
          style: { padding: "12px 28px", borderRadius: 10, border: "1px solid #6E845044", background: "#6E845018", color: "#EBF0E1", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
        }, "Reload App")
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <IOWNDashboard />
    </ErrorBoundary>
  </React.StrictMode>,
)
