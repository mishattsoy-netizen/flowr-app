# Download Instruction Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace immediate download on the download button with an OS-specific instruction popup that users must read before downloading.

**Architecture:** One new reusable modal component (`DownloadInstructionModal`) + one modified entry point (`InstallButton`). The modal detects OS via user agent and renders the appropriate step-by-step instructions. A 5-second progress timer gates the checkbox, which gates the download button.

**Tech Stack:** React/Next.js client component, Lucide icons, existing CSS variable theme

---
