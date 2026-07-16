# ELVY AI LANGUAGE PLATFORM

> **Upload your syllabus. Elvy understands it. Elvy teaches it.**

---

# Vision

Elvy is an AI-powered English language learning platform built around one core principle:

> **Elvy never teaches before it understands the curriculum.**

Unlike traditional AI tutors that teach from a generic language model, Elvy first studies the uploaded syllabus or textbook, builds a complete curriculum structure, generates lesson plans, and then teaches according to that curriculum.

The Curriculum Reader is the heart of the platform.

---

# Project Status

## Foundation

- ✅ Mobile Application
- ✅ AI Chat Engine
- ✅ Voice Mode
- ✅ Founder Dashboard
- ✅ Curriculum Reader Dashboard
- ✅ Lesson Plan Studio
- ✅ Curriculum Reader Engine
- ✅ Shared AI Gateway

## Current Development

- 🚧 Vision Reader
- 🚧 Curriculum Intelligence
- 🚧 Automatic Lesson Plan Generation
- 🚧 Elvy Teaching Blueprint Intelligence

---

# Platform Architecture

```text
Teacher
      │
      ▼
Upload Syllabus
      │
      ▼
Curriculum Reader
      │
      ▼
Curriculum Tree
(Level → Sublevel → Unit → Lesson)
      │
      ▼
Lesson Plan Studio
      ├── Teacher Lesson Plan
      └── Elvy Teaching Blueprint
                    │
                    ▼
             Elvy teaches students
```

---

# Project Structure

```text
app/
components/
data/
lib/
public/
services/
```

---

# Shared Infrastructure

```text
lib/
    openai.ts
    supabase.ts
```

Shared by:

- Elvy Chat
- Curriculum Reader
- Lesson Generator
- Future AI Services

---

# Curriculum Reader Engine

```text
services/
└── curriculum-reader/
    reader-engine.ts
    document-extractor.ts
    pdf-renderer.ts
    page-model.ts
    book-analyzer.ts
    vision-reader.ts
    page-analyzer.ts
    curriculum-analyzer.ts
    lesson-generator.ts
    types.ts
```

---

# Curriculum Reader Workflow

```text
Upload Book
      ↓
Extract Text
      ↓
Render PDF Pages
      ↓
Vision Reader
      ↓
Book Analyzer
      ↓
Curriculum Analyzer
      ↓
Curriculum Tree
      ↓
Lesson Generator
      ↓
Lesson Plan Studio
```

---

# Lesson Plan Studio

Every lesson detected by the Curriculum Reader is automatically linked to one Lesson Plan Studio.

Each Lesson Plan Studio contains:

- Lesson Information
- Learning Objectives
- Competencies
- Language Focus
- Lesson Procedure
- Activities
- Assessment
- Homework

Teachers can:

- View Lesson Plan
- Edit Lesson Plan
- Preview Lesson Plan
- Download Teacher Lesson Plan

Elvy internally uses the **Teaching Blueprint**, which contains AI teaching methodology and is **not visible to teachers**.

---

# AI Architecture

```text
                   OpenAI
                      │
               lib/openai.ts
                      │
      ┌───────────────┼───────────────┐
      ▼               ▼               ▼
 Elvy Chat    Curriculum Reader   Future AI Services
```

---

# Curriculum Intelligence

The Vision Reader is designed to detect:

- Levels
- Sublevels
- Units
- Lessons
- Grammar
- Vocabulary
- Reading
- Listening
- Speaking
- Writing
- Projects
- Assessments
- Review Sections
- Cultural Pages

The goal is to understand **any curriculum**, not just one textbook.

---

# Development Roadmap

## Sprint 6

- ✅ AI Gateway
- ✅ Curriculum Reader Engine
- ✅ PDF Renderer
- ✅ Book Analyzer
- 🚧 Vision Reader
- 🚧 Curriculum Intelligence

## Sprint 7

- Automatic Lesson Plan Studio Generation

## Sprint 8

- Teaching Blueprint Intelligence

## Sprint 9

- Student Learning Engine

---

# Architecture Principles

### 1. Curriculum First

Elvy never teaches before understanding the curriculum.

### 2. Single Responsibility

Each page and module has one clear responsibility.

### 3. One Shared AI Gateway

All AI features use:

```text
lib/openai.ts
```

### 4. Curriculum Independence

The platform must work with **any syllabus**.

### 5. Teacher Control

Teachers remain in control.

Elvy supports teachers—it does not replace them.

---

# Long-Term Vision

```text
Upload your syllabus.

↓

Elvy understands your curriculum.

↓

Elvy builds every lesson.

↓

Elvy creates lesson plans.

↓

Elvy teaches students.

↓

Teachers remain in control.
```

---

# Mission

> **To build the world's first AI language teacher that truly understands a school's curriculum before teaching it.**

## Core Principle

> **Upload your syllabus. Elvy understands it. Elvy teaches it.**