import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:3000";

function App() {
  const [clients, setClients] = useState([]);
  const [panel, setPanel] = useState(null); // { type: 'notes' | 'addNote' | 'analysis', clientId }
  const [notes, setNotes] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add client form
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newIssue, setNewIssue] = useState("");

  // Add note form
  const [noteSession, setNoteSession] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState("");

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const res = await fetch(`${API}/clients`);
    const data = await res.json();
    setClients(data.clients);
  };

  const addClient = async (e) => {
    e.preventDefault();
    await fetch(`${API}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, age: Number(newAge), presentingIssue: newIssue }),
    });
    setNewName("");
    setNewAge("");
    setNewIssue("");
    fetchClients();
  };

  const deleteClient = async (id) => {
    if (!window.confirm("Delete this client?")) return;
    await fetch(`${API}/clients/${id}`, { method: "DELETE" });
    if (panel?.clientId === id) setPanel(null);
    fetchClients();
  };

  const openNotes = async (clientId) => {
    setPanel({ type: "notes", clientId });
    setError("");
    setLoading(true);
    const res = await fetch(`${API}/clients/${clientId}/notes`);
    const data = await res.json();
    setNotes(data.notes);
    setLoading(false);
  };

  const openAddNote = (clientId) => {
    setPanel({ type: "addNote", clientId });
    setNoteSession("");
    setNoteContent("");
    setNoteDate("");
  };

  const addNote = async (e) => {
    e.preventDefault();
    await fetch(`${API}/clients/${panel.clientId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionNumber: Number(noteSession),
        content: noteContent,
        date: noteDate,
      }),
    });
    openNotes(panel.clientId);
  };

  const getGeminiAnalysis = async (clientId) => {
    setPanel({ type: "analysis", clientId });
    setAnalysis(null);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/clients/${clientId}/gemini-analysis`);
      const data = await res.json();
      if (res.ok) {
        setAnalysis(data);
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch {
      setError("Could not connect to server");
    }
    setLoading(false);
  };

  const selectedClient = clients.find((c) => c.id === panel?.clientId);

  return (
    <div className="app">
      <header className="header">
        <h1>CaseNote AI</h1>
        <p>Therapy session notes, simplified</p>
      </header>

      <main className="main">

        {/* Add Client */}
        <section className="card">
          <h2>Add New Client</h2>
          <form className="form" onSubmit={addClient}>
            <input
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <input
              placeholder="Age"
              type="number"
              value={newAge}
              onChange={(e) => setNewAge(e.target.value)}
              required
            />
            <input
              placeholder="Presenting issue"
              value={newIssue}
              onChange={(e) => setNewIssue(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary">Add Client</button>
          </form>
        </section>

        {/* Client List */}
        <section>
          <h2 className="section-title">Clients ({clients.length})</h2>
          {clients.length === 0 && (
            <p className="empty">No clients yet. Add one above.</p>
          )}
          <div className="client-grid">
            {clients.map((c) => (
              <div
                key={c.id}
                className={`client-card ${panel?.clientId === c.id ? "active" : ""}`}
              >
                <div className="client-info">
                  <h3>{c.name}</h3>
                  <span className="badge">{c.presentingIssue}</span>
                  <p className="age">Age: {c.age}</p>
                </div>
                <div className="client-actions">
                  <button className="btn btn-secondary" onClick={() => openNotes(c.id)}>
                    View Notes
                  </button>
                  <button className="btn btn-secondary" onClick={() => openAddNote(c.id)}>
                    Add Note
                  </button>
                  <button className="btn btn-ai" onClick={() => getGeminiAnalysis(c.id)}>
                    Gemini Analysis
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteClient(c.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Panel */}
        {panel && selectedClient && (
          <section className="panel">
            <div className="panel-header">
              <h2>
                {panel.type === "notes" && `Notes — ${selectedClient.name}`}
                {panel.type === "addNote" && `Add Note — ${selectedClient.name}`}
                {panel.type === "analysis" && `Gemini Analysis — ${selectedClient.name}`}
              </h2>
              <button className="btn-close" onClick={() => setPanel(null)}>✕</button>
            </div>

            {/* View Notes */}
            {panel.type === "notes" && (
              <div>
                {loading && <p className="loading">Loading notes...</p>}
                {!loading && notes.length === 0 && (
                  <p className="empty">No notes yet for this client.</p>
                )}
                <div className="notes-list">
                  {notes.map((n, i) => (
                    <div key={i} className="note-card">
                      <div className="note-meta">
                        Session {n.sessionNumber} &mdash; {n.date}
                      </div>
                      <p>{n.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Note */}
            {panel.type === "addNote" && (
              <form className="form" onSubmit={addNote}>
                <input
                  placeholder="Session number"
                  type="number"
                  value={noteSession}
                  onChange={(e) => setNoteSession(e.target.value)}
                  required
                />
                <input
                  placeholder="Date"
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  required
                />
                <textarea
                  placeholder="Session notes..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                  required
                />
                <button type="submit" className="btn btn-primary">Save Note</button>
              </form>
            )}

            {/* Gemini Analysis */}
            {panel.type === "analysis" && (
              <div>
                {loading && <p className="loading">Generating AI analysis...</p>}
                {error && <p className="error">{error}</p>}
                {analysis && (
                  <div className="analysis">

                    <div className="analysis-block">
                      <h4>Presenting Concerns</h4>
                      <p>{analysis.presentingConcerns}</p>
                    </div>

                    <div className="analysis-block">
                      <h4>Automatic Thoughts</h4>
                      <div className="tag-list">
                        {Array.isArray(analysis.automaticThoughts) &&
                          analysis.automaticThoughts.map((t, i) => (
                            <span key={i} className="tag tag-thought">{t}</span>
                          ))}
                      </div>
                    </div>

                    <div className="analysis-block">
                      <h4>Emotions</h4>
                      <div className="tag-list">
                        {Array.isArray(analysis.emotions) &&
                          analysis.emotions.map((e, i) => (
                            <span key={i} className="tag tag-emotion">{e}</span>
                          ))}
                      </div>
                    </div>

                    <div className="analysis-block">
                      <h4>Behaviors</h4>
                      <div className="tag-list">
                        {Array.isArray(analysis.behaviors) &&
                          analysis.behaviors.map((b, i) => (
                            <span key={i} className="tag tag-behavior">{b}</span>
                          ))}
                      </div>
                    </div>

                    <div className="analysis-block">
                      <h4>Possible Core Beliefs</h4>
                      <div className="tag-list">
                        {Array.isArray(analysis.possibleCoreBeliefs) &&
                          analysis.possibleCoreBeliefs.map((b, i) => (
                            <span key={i} className="tag tag-belief">{b}</span>
                          ))}
                      </div>
                    </div>

                    <div className="analysis-block">
                      <h4>Cognitive Distortions</h4>
                      <div className="tag-list">
                        {Array.isArray(analysis.cognitiveDistortions) &&
                          analysis.cognitiveDistortions.map((d, i) => (
                            <span key={i} className="tag tag-distortion">{d}</span>
                          ))}
                      </div>
                    </div>

                    <div className="analysis-block analysis-focus">
                      <h4>Suggested CBT Focus</h4>
                      <p>{analysis.suggestedCBTFocus}</p>
                    </div>

                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
