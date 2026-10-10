const express = require("express");
const router = express.Router();

const Client = require("../models/Client");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// GET /clients — return all clients
router.get("/", async (req, res) => {
  try {
    const clients = await Client.find();

    res.json({ clients });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve clients",
    });
  }
});

// POST /clients — save a new client
router.post("/", async (req, res) => {
  try {
    const { name, age, presentingIssue } = req.body;

    if (!name || !age || !presentingIssue) {
      return res.status(400).json({
        error: "name, age, and presentingIssue are all required",
      });
    }

    const newClient = await Client.create({
      name,
      age,
      presentingIssue,
    });

    res.status(201).json({
      message: "Client saved successfully",
      client: newClient,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create client",
    });
  }
});

// DELETE /clients/:id — remove a client by ID
router.delete("/:id", async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    res.json({
      message: "Client deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete client",
    });
  }
});

// PUT /clients/:id — update a client's fields
router.put("/:id", async (req, res) => {
  try {
    const { name, age, presentingIssue } = req.body;

    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      {
        name,
        age,
        presentingIssue,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedClient) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    res.json({
      message: "Client updated successfully",
      client: updatedClient,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update client",
    });
  }
});

// GET /clients/:id/notes — return all notes for a specific client
router.get("/:id/notes", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    res.json({
      notes: client.notes,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve notes",
    });
  }
});

// POST /clients/:id/notes — add a note to a specific client
router.post("/:id/notes", async (req, res) => {
  try {
    const { sessionNumber, content, date } = req.body;

    if (!sessionNumber || !content || !date) {
      return res.status(400).json({
        error: "sessionNumber, content, and date are all required",
      });
    }

    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    const note = {
      sessionNumber,
      content,
      date,
    };

    client.notes.push(note);

    client.analysis = null;
    client.geminiAnalysis = null;

    await client.save();

    res.status(201).json({
      message: "Note added successfully",
      client,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to add note",
    });
  }
});

// GET /clients/:id/analysis — return a simple rule-based analysis of the client's notes
router.get("/:id/analysis", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    if (!client.notes || client.notes.length === 0) {
      return res.status(400).json({
        error: "No notes found for this client",
      });
    }

    if (client.analysis) {
      return res.json(client.analysis);
    }

    const allText = client.notes.map((n) => n.content.toLowerCase()).join(" ");

    const themeKeywords = {
      anxiety: [
        "anxious",
        "anxiety",
        "worry",
        "worried",
        "nervous",
        "panic",
        "fear",
        "stress",
      ],
      depression: [
        "depressed",
        "depression",
        "sad",
        "hopeless",
        "empty",
        "low mood",
        "worthless",
      ],
      sleep: [
        "sleep",
        "insomnia",
        "tired",
        "fatigue",
        "exhausted",
        "restless",
        "nightmares",
      ],
      relationships: [
        "family",
        "partner",
        "friend",
        "relationship",
        "conflict",
        "lonely",
        "isolated",
      ],
      work: [
        "work",
        "job",
        "career",
        "boss",
        "colleague",
        "burnout",
        "pressure",
        "deadline",
      ],
      selfEsteem: [
        "confidence",
        "self-esteem",
        "self-worth",
        "ashamed",
        "guilty",
        "embarrassed",
      ],
    };

    const keyThemes = Object.keys(themeKeywords).filter((theme) =>
      themeKeywords[theme].some((keyword) => allText.includes(keyword)),
    );

    const sessionCount = client.notes.length;

    const summary =
      `${client.name} has had ${sessionCount} session${sessionCount > 1 ? "s" : ""} recorded. ` +
      (keyThemes.length > 0
        ? `Notes mention themes related to: ${keyThemes.join(", ")}.`
        : "No specific recurring themes were detected in the notes.");

    const focusMap = {
      anxiety:
        "Consider exploring coping strategies and relaxation techniques for anxiety.",
      depression:
        "Focus on behavioural activation and identifying sources of low mood.",
      sleep: "Discuss sleep hygiene and factors disrupting rest.",
      relationships:
        "Explore interpersonal dynamics and communication patterns.",
      work: "Address work-related stressors and boundary-setting strategies.",
      selfEsteem:
        "Work on building self-compassion and challenging negative self-talk.",
    };

    const suggestedFocus =
      keyThemes.length > 0
        ? focusMap[keyThemes[0]]
        : "Continue open-ended exploration to identify the client's primary concerns.";

    client.analysis = {
      summary,
      keyThemes,
      suggestedFocus,
    };

    await client.save();

    res.json({
      summary,
      keyThemes,
      suggestedFocus,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to analyze client notes",
    });
  }
});

// GET /clients/:id/gemini-analysis — AI analysis of client notes
router.get("/:id/gemini-analysis", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    if (!client.notes || client.notes.length === 0) {
      return res.status(400).json({
        error: "No notes available",
      });
    }

    const notesText = client.notes
      .map((n) => `Session ${n.sessionNumber}: ${n.content}`)
      .join("\n");

    const prompt = `
You are a CBT-trained therapist assistant.
Analyze the session notes below in chronological order.

Where relevant, note any progress or changes across sessions.

Return ONLY a valid JSON object with exactly these seven keys:

- "presentingConcerns": a short paragraph describing the main issues the client has presented across sessions

- "automaticThoughts": an array of automatic thought strings identified from the notes

- "emotions": an array of emotion strings the client has expressed

- "behaviors": an array of behavioral patterns observed

- "possibleCoreBeliefs": an array of possible underlying core belief strings

- "cognitiveDistortions": an array of cognitive distortion strings present

- "suggestedCBTFocus": a single sentence recommending a CBT intervention or focus area for the next session

Do not include any explanation, markdown, or code blocks.
Return only raw JSON.

Session notes:
${notesText}
`;

    const result = await model.generateContent(prompt);

    const response = await result.response;

    const text = response.text().trim();

    const parsed = JSON.parse(text);

    client.geminiAnalysis = parsed;

    await client.save();

    res.json(parsed);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Gemini request failed",
    });
  }
});

/* // POST /clients/:id/generate-session-note
// Generate DAP note from therapist form
router.post("/:id/generate-session-note", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        error: "Client not found",
      });
    }

    const {
      sessionNumber,
      date,
      therapeuticApproach,
      mood,
      appearanceEnergy,
      engagement,
      mainTopics,
      interventionsUsed,
      riskAssessment,
      therapistRawNotes,
      homework,
      nextSessionFocus,
    } = req.body;

    if (!sessionNumber || !date || !therapistRawNotes) {
      return res.status(400).json({
        error: "sessionNumber, date, and therapistRawNotes are required",
      });
    }

    const prompt = `
You are a professional clinical documentation assistant.

Create a clear DAP therapy session note based on the therapist form below.

Use professional, neutral, clinical language.

Do not diagnose.

Do not add information that was not provided.

If information is missing, write only based on available information.

Return ONLY a valid JSON object with exactly these keys:

{
  "data": "D section of the note",
  "assessment": "A section of the note",
  "plan": "P section of the note",
  "briefSummary": "short clinical summary",
  "riskFlag": "No risk identified / Risk noted / Inconclusive",
  "suggestedTags": ["tag1", "tag2"]
}

Client:

Name: ${client.name}

Age: ${client.age}

Presenting Issue: ${client.presentingIssue}

Session Form:

Session Number: ${sessionNumber}

Date: ${date}

Therapeutic Approach: ${(therapeuticApproach || []).join(", ")}

Mood: ${(mood || []).join(", ")}

Appearance / Energy: ${(appearanceEnergy || []).join(", ")}

Engagement: ${(engagement || []).join(", ")}

Main Topics: ${(mainTopics || []).join(", ")}

Interventions Used: ${(interventionsUsed || []).join(", ")}

Risk Assessment: ${riskAssessment || "Not provided"}

Therapist Raw Notes: ${therapistRawNotes}

Homework: ${homework || "Not provided"}

Next Session Focus: ${nextSessionFocus || "Not provided"}
`;

    const result = await model.generateContent(prompt);

    const response = await result.response;

    const text = response.text().trim();

    const parsed = JSON.parse(text);

    res.json(parsed);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Session note generation failed",
    });
  }
}); */

module.exports = router;
