---
name: Local speech transcription backends
description: A Replit Nix speech binary may lack its CPU inference backend despite installing successfully.
---

An installed whisper.cpp executable can report zero inference devices and crash
because the packaged GGML CPU backend is absent. Successful package installation
does not prove that CPU inference works.

**Why:** This workspace's Nix speech package had no usable inference backend;
an explicitly CPU-enabled local build worked. Repeating the packaged command
would not have addressed the missing backend.

**How to apply:** If local speech transcription is requested again, inspect the
backend/device diagnostics before retrying or downloading larger models. Verify
a short sample's language and quality before processing long recordings. Repeated
phrases are unreliable output, not evidence of what a speaker said.
