# Design: Vision-First Multimodal Orchestrator

**Date**: 2026-05-11  
**Status**: VALIDATED  
**Topic**: AI Pipeline Architecture

## 1. Overview
Transform the `VISION` intent from a simple image describer into a **Multimodal Front-End Classifier/Orchestrator**. This architectural shift makes the Vision chain the "eyes" and "initial brain" of the system whenever images are present, allowing it to ground all subsequent tools and chains in visual reality.

## 2. Core Architecture

### 2.1 Multimodal Entry Point
- **Trigger**: Any request containing 1–10 images (Buffers or URLs) bypasses the standard `CLASSIFIER`.
- **Primary Handler**: The `VISION` chain (supported by Gemini 1.5/2.0 or compatible Vision models).
- **Context Injection**:
    - Up to 10 image buffers.
    - User message text.
    - Configurable Chat History.
    - System Date/Time and Global Rules.

### 2.2 The "Logic-Driven" Brain
The Vision system prompt is configured to output three distinct response types based on intent detection:

#### A. Direct Answer
- Used for simple questions about the image that don't require external tools.
- *Example*: "What color is this shirt?" → "The shirt is blue."

#### B. Clarification
- Triggered if intent is ambiguous or if multiple unrelated tasks are detected in a single batch of images.
- *Example*: "I see a utility bill and a photo of a dog. Which one should I help you with first?"

#### C. Orchestration Metadata (JSON)
- Triggered when the task requires specialized chains (Search, Research, Coding, Tools).
- **Structure**:
    ```json
    {
      "logic_nature": "requires_research",
      "digital_twin": "A detailed text-based transcription of the relevant image data (OCR, objects, context).",
      "next_instructions": "Specific instructions for the next chain in the pipeline."
    }
    ```

## 3. The Orchestration Handoff

### 3.1 Data Translation ("Digital Twin")
Subsequent chains (Search, Tools, Research) are often text-only. The Vision model must translate visual data into a **Digital Twin** (text-based representation) so the rest of the pipeline can "see" the data through its eyes.

### 3.2 Dynamic Chain Mapping
The Orchestrator receives the Vision metadata and maps the `logic_nature` to one or more internal categories:
- `requires_research` → `RESEARCH` + `WEB_SEARCH`
- `requires_math` → `TOOL_CALLING` (Calculator) + `MEDIUM_THINKING`
- `requires_code_fix` → `CODING` + `COMPLEX_THINKING`

### 3.3 Context Injection
The `digital_twin` and `next_instructions` are injected as a **System Block** into all subsequent models in that turn, providing perfect multimodal grounding.

## 4. Implementation Batches

### Batch 1: Multi-Image & Routing
- Update `chainRouter.ts` to support 10 images.
- Update `pipeline.ts` to skip `classifier` if images are present.
- Implement Vision-to-Metadata parsing.

### Batch 2: Metadata Injection
- Update Orchestrator state to carry `vision_notes`.
- Implement System Prompt injection for subsequent chains.

### Batch 3: System Prompting
- Update the `VISION` system prompt in the database (via Admin or SQL) to reflect the new "Classifier" persona.
