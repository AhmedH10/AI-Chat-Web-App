const { useState, useEffect, useRef } = React;

function App() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  // Load chat history on mount
  useEffect(() => { loadHistory(); }, []);

  // Scroll to bottom on new message
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setMessages(data);
    } catch {
      setError("Failed to load history");
    }
  }

  async function sendPrompt() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");

    const newMessage = { prompt, reply: "" };
    setMessages(prev => [...prev, newMessage]);

    try {
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.delta) {
              accumulated += data.delta;
              setMessages(prev =>
                prev.map(m => (m === newMessage ? { ...m, reply: accumulated } : m))
              );
            }
            if (data.done) {
              setLoading(false);
            }
          } catch (err) {
            console.error("JSON parse error:", err);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Streaming request failed");
      setLoading(false);
    }

    setPrompt("");
  }

  async function clearHistory() {
    await fetch("/api/history", { method: "DELETE" });
    setMessages([]);
  }

  // Simple Markdown renderer for **bold**
  function renderMarkdown(text) {
    return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? React.createElement("strong", { key: i }, part) : part
    );
  }

  return React.createElement(
    "div",
    { className: "min-h-screen flex flex-col items-center p-4" },

    // Header
    React.createElement(
      "div",
      { className: "w-full max-w-2xl flex justify-between items-center mb-4" },
      React.createElement("h1", { className: "text-2xl font-bold" }, "Ahmed's AI Chat"),
      React.createElement(
        "button",
        { onClick: clearHistory, className: "bg-red-500 text-white px-3 py-1 rounded" },
        "Clear"
      )
    ),

    // Chat box
    React.createElement(
      "div",
      { className: "w-full max-w-2xl bg-white rounded shadow p-4 h-[60vh] overflow-y-auto" },
      messages.map((m, i) =>
        React.createElement(
          "div",
          { key: i, className: "mb-4" },
          React.createElement(
            "div",
            { className: "bg-gray-200 p-2 rounded mb-1" },
            renderMarkdown(m.prompt)
          ),
          React.createElement(
            "div",
            { className: "bg-blue-100 p-2 rounded" },
            renderMarkdown(m.reply)
          )
        )
      ),
      loading &&
        React.createElement("div", { className: "text-gray-500 italic" }, "Thinking..."),
      React.createElement("div", { ref: bottomRef })
    ),

    // Error message
    error && React.createElement("div", { className: "text-red-500 mt-2" }, error),

    // Input area
    React.createElement(
      "div",
      { className: "w-full max-w-2xl mt-4" },
      React.createElement("textarea", {
        value: prompt,
        onChange: e => setPrompt(e.target.value),
        placeholder: "Type your prompt...",
        className: "w-full border rounded p-2 mb-2",
      }),
      React.createElement(
        "button",
        {
          onClick: sendPrompt,
          disabled: loading,
          className: "bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50",
        },
        loading ? "Thinking..." : "Send"
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(App)
);