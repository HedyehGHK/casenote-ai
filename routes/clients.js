const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');


const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const DATA_FILE = path.join(__dirname, '../data/clients.json');

function readClients() {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeClients(clients) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(clients, null, 2));
}

// GET /clients — return all clients
router.get('/', (req, res) => {
  const clients = readClients();
  res.json({ clients });
});

// POST /clients — save a new client
router.post('/', (req, res) => {
  const { name, age, presentingIssue } = req.body;

  if (!name || !age || !presentingIssue) {
    return res.status(400).json({ error: 'name, age, and presentingIssue are all required' });
  }

  const clients = readClients();

  const newClient = {
    id: clients.length + 1,
    name,
    age,
    presentingIssue,
    notes: [],
  };

  clients.push(newClient);
  writeClients(clients);

  res.status(201).json({
    message: 'Client saved successfully',
    client: newClient,
  });
});

// DELETE /clients/:id — remove a client by ID
router.delete('/:id', (req, res) => {
  const clientId = parseInt(req.params.id);
  const clients = readClients();
  const index = clients.findIndex(c => c.id === clientId);

  if (index === -1) {
    return res.status(404).json({ error: 'Client not found' });
  }

  clients.splice(index, 1);
  writeClients(clients);

  res.json({ message: 'Client deleted successfully' });
});

// PUT /clients/:id — update a client's fields
router.put('/:id', (req, res) => {
  const clientId = parseInt(req.params.id);
  const { name, age, presentingIssue } = req.body;

  const clients = readClients();
  const client = clients.find(c => c.id === clientId);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  if (name) client.name = name;
  if (age) client.age = age;
  if (presentingIssue) client.presentingIssue = presentingIssue;

  writeClients(clients);

  res.json({ message: 'Client updated successfully', client });
});

// GET /clients/:id/notes — return all notes for a specific client
router.get('/:id/notes', (req, res) => {
  const clientId = parseInt(req.params.id);
  const clients = readClients();
  const client = clients.find(c => c.id === clientId);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  res.json({ notes: client.notes });
});

// POST /clients/:id/notes — add a note to a specific client
router.post('/:id/notes', (req, res) => {
  const clientId = parseInt(req.params.id);
  const { sessionNumber, content, date } = req.body;

  const clients = readClients();
  const client = clients.find(c => c.id === clientId);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  if (!sessionNumber || !content || !date) {
    return res.status(400).json({ error: 'sessionNumber, content, and date are all required' });
  }

  const note = { sessionNumber, content, date };
  client.notes.push(note);
  writeClients(clients);

  res.status(201).json({
    message: 'Note added successfully',
    client,
  });
});

// GET /clients/:id/analysis — return a simple rule-based analysis of the client's notes
router.get('/:id/analysis', (req, res) => {
  const clientId = parseInt(req.params.id);
  const clients = readClients();
  const client = clients.find(c => c.id === clientId);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  if (client.notes.length === 0) {
    return res.status(400).json({ error: 'No notes found for this client' });
  }

  if (client.analysis) {
    return res.json(client.analysis);
  }

  const allText = client.notes.map(n => n.content.toLowerCase()).join(' ');

  const themeKeywords = {
    anxiety:       ['anxious', 'anxiety', 'worry', 'worried', 'nervous', 'panic', 'fear', 'stress'],
    depression:    ['depressed', 'depression', 'sad', 'hopeless', 'empty', 'low mood', 'worthless'],
    sleep:         ['sleep', 'insomnia', 'tired', 'fatigue', 'exhausted', 'restless', 'nightmares'],
    relationships: ['family', 'partner', 'friend', 'relationship', 'conflict', 'lonely', 'isolated'],
    work:          ['work', 'job', 'career', 'boss', 'colleague', 'burnout', 'pressure', 'deadline'],
    selfEsteem:    ['confidence', 'self-esteem', 'self-worth', 'ashamed', 'guilty', 'embarrassed'],
  };

  const keyThemes = Object.keys(themeKeywords).filter(theme =>
    themeKeywords[theme].some(keyword => allText.includes(keyword))
  );

  const sessionCount = client.notes.length;
  const summary =
    `${client.name} has had ${sessionCount} session${sessionCount > 1 ? 's' : ''} recorded. ` +
    (keyThemes.length > 0
      ? `Notes mention themes related to: ${keyThemes.join(', ')}.`
      : 'No specific recurring themes were detected in the notes.');

  const focusMap = {
    anxiety:       'Consider exploring coping strategies and relaxation techniques for anxiety.',
    depression:    'Focus on behavioural activation and identifying sources of low mood.',
    sleep:         'Discuss sleep hygiene and factors disrupting rest.',
    relationships: 'Explore interpersonal dynamics and communication patterns.',
    work:          'Address work-related stressors and boundary-setting strategies.',
    selfEsteem:    'Work on building self-compassion and challenging negative self-talk.',
  };

  const suggestedFocus =
    keyThemes.length > 0
      ? focusMap[keyThemes[0]]
      : 'Continue open-ended exploration to identify the client\'s primary concerns.';

  client.analysis = { summary, keyThemes, suggestedFocus };
  writeClients(clients);

  res.json({ summary, keyThemes, suggestedFocus });
});

router.get('/:id/gemini-analysis', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const clients = readClients();
    const client = clients.find(c => c.id === clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.notes || client.notes.length === 0) {
      return res.status(400).json({ error: 'No notes available' });
    }

    const notesText = client.notes
      .map(n => `Session ${n.sessionNumber}: ${n.content}`)
      .join('\n');

    const prompt = `
You are a CBT-trained therapist assistant. Analyze the session notes below in chronological order.

Where relevant, note any progress or changes across sessions.

Return ONLY a valid JSON object with exactly these seven keys:
- "presentingConcerns": a short paragraph describing the main issues the client has presented across sessions
- "automaticThoughts": an array of automatic thought strings identified from the notes (e.g. ["I am a failure", "Nothing will get better"])
- "emotions": an array of emotion strings the client has expressed (e.g. ["anxiety", "sadness", "shame"])
- "behaviors": an array of behavioral patterns observed (e.g. ["avoidance", "social withdrawal"])
- "possibleCoreBeliefs": an array of possible underlying core belief strings (e.g. ["I am unlovable", "The world is unsafe"])
- "cognitiveDistortions": an array of cognitive distortion strings present (e.g. ["all-or-nothing thinking", "catastrophising"])
- "suggestedCBTFocus": a single sentence recommending a CBT intervention or focus area for the next session

Do not include any explanation, markdown, or code blocks. Return only raw JSON.

Session notes (in order):
${notesText}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    const parsed = JSON.parse(text);

    client.geminiAnalysis = parsed;
    writeClients(clients);

    res.json(parsed);

  } catch (error) {
    res.status(500).json({
      error: error.message || 'Gemini request failed',
    });
  }
});

module.exports = router;
