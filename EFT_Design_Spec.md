# SealBox — Design Specification

**Product:** SealBox (Encrypted File Transfer)  
**Document type:** UI/UX design specification  
**Version:** 1.0  
**Status:** Proposed design baseline

---

## 1. Product Overview

SealBox is a web application for encrypting files and allowing intended recipients to decrypt them with their private keys. The interface should make a security-sensitive workflow feel clear, calm, and approachable without hiding important technical details.

### Product goals

- Make file encryption and decryption easy to understand for non-experts.
- Clearly distinguish a recipient's **public key** from their **private key**.
- Explain what happens to files and keys at each stage.
- Provide understandable progress, validation, success, and error states.
- Maintain a consistent, accessible interface across desktop, tablet, and mobile.

### Design principles

1. **Clarity over decoration:** make the next action obvious.
2. **Trust through transparency:** explain security behavior accurately; never use visual polish as a substitute for facts.
3. **Consistency:** reuse tokens, components, and interaction patterns on every page.
4. **Progressive disclosure:** keep the primary workflow simple while making technical details available when needed.
5. **Accessible by default:** support keyboard navigation, readable contrast, clear labels, and status text that does not rely on color alone.

---

## 2. Visual Direction

### Style

Use a **light-first, minimalist Security SaaS** visual language: white and off-white surfaces, charcoal typography, subtle grey borders, restrained blue interaction accents, and generous whitespace.

The application should feel like a carefully made productivity or developer tool—not a futuristic cybersecurity landing page.

### Avoid

- Green or lime as decorative accent colors.
- Neon glows, glowing locks, particle backgrounds, and excessive gradients.
- Glassmorphism and heavy drop shadows.
- Decorative charts or metrics that do not help users complete a task.
- Oversized stock imagery and generic cybersecurity illustrations.
- Inconsistent icon families, random corner radii, or unnecessary animation.
- Claims such as “unhackable” or “100% secure.”

---

## 3. Design Tokens

Use these as the initial design tokens. Keep them centralized in CSS variables or the project's token system so they can be adjusted consistently.

### 3.1 Color palette

| Token | Hex | Usage |
|---|---|---|
| `--color-page` | `#F8FAFC` | Main page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, menus, and dialogs |
| `--color-surface-muted` | `#F1F5F9` | Subtle secondary surfaces and disabled backgrounds |
| `--color-text` | `#111827` | Primary text and headings |
| `--color-text-muted` | `#6B7280` | Supporting text, descriptions, and metadata |
| `--color-border` | `#E5E7EB` | Default borders and dividers |
| `--color-border-strong` | `#CBD5E1` | Emphasized borders and control outlines |
| `--color-primary` | `#2563EB` | Primary buttons, links, selected controls, and focus accents |
| `--color-primary-hover` | `#1D4ED8` | Hover state for primary actions |
| `--color-primary-soft` | `#DBEAFE` | Subtle selected or informational surfaces |
| `--color-success` | `#166534` | Confirmed success states only |
| `--color-success-soft` | `#F0FDF4` | Success feedback backgrounds |
| `--color-warning` | `#92400E` | Warnings and potentially destructive consequences |
| `--color-warning-soft` | `#FFFBEB` | Warning feedback backgrounds |
| `--color-danger` | `#B91C1C` | Errors and destructive actions |
| `--color-danger-soft` | `#FEF2F2` | Error feedback backgrounds |

**Rules:** Use blue as the main interaction accent. Keep status colors semantic, restrained, and paired with an icon or written label. Do not communicate success, failure, or warnings through color alone. Check final text/background contrast before release.

### 3.2 Typography

**Preferred typeface:** Inter. Geist is an acceptable alternative if already included in the project. Use a reliable system sans-serif fallback.

| Token | Size | Weight | Typical use |
|---|---:|---:|---|
| `--text-xs` | 12px | 400–500 | Helper text, timestamps, compact metadata |
| `--text-sm` | 14px | 400–500 | Labels, secondary text, table metadata |
| `--text-base` | 16px | 400 | Body copy and standard controls |
| `--text-lg` | 18px | 500–600 | Card headings and lead text |
| `--text-xl` | 20px | 600 | Section headings |
| `--text-2xl` | 24px | 600–700 | Page-level headings in app screens |
| `--text-3xl` | 32px | 600–700 | Landing-page hero heading |

Body line-height should generally be 1.5. Use concise headings and avoid long blocks of all-caps text. Reserve uppercase text for small section labels when useful.

### 3.3 Spacing

Use an 8px-based spacing scale. A 4px half-step may be used for fine alignment.

| Token | Value |
|---|---:|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

Use 16–24px inside compact cards, 24–32px inside larger panels, and 48–64px between major landing-page sections. Do not add whitespace mechanically; use it to establish hierarchy.

### 3.4 Borders, radius, and elevation

| Token | Value | Usage |
|---|---:|---|
| `--radius-sm` | 6px | Small controls and tags |
| `--radius-md` | 10px | Buttons, inputs, and ordinary cards |
| `--radius-lg` | 14px | Main workflow panels and dialogs |
| `--radius-xl` | 18px | Optional large hero containers |
| `--border-width` | 1px | Standard component borders |

Prefer borders over shadows. If elevation is needed for a popover or dialog, use a soft, low-opacity shadow. Avoid multiple layers of strong shadow.

### 3.5 Layout and breakpoints

- **Content width:** target a maximum width of approximately 1120px for primary page content.
- **Reading width:** keep explanatory copy around 60–75 characters per line where practical.
- **Desktop:** 1024px and wider.
- **Tablet:** 768–1023px.
- **Mobile:** below 768px.
- **Small mobile:** below 480px.

These are initial responsive breakpoints, not rigid device categories. Use CSS Grid and Flexbox with fluid sizing where appropriate. Prevent horizontal overflow at all widths.

---

## 4. Iconography and Imagery

- Use one consistent line-icon family, preferably Lucide.
- Standard icon size: 18–20px in controls; 22–24px for larger feature or empty-state illustrations.
- Keep stroke weights consistent; do not mix filled icons with thin line icons without a deliberate reason.
- Icons must supplement, not replace, text labels for important actions.
- The product does not need decorative stock imagery. Use simple diagrams only when they explain the encryption process.

---

## 5. Information Architecture

The primary navigation should remain compact.

### Proposed navigation

- **Encrypt file** — primary workflow.
- **Decrypt file** — recover an original file from an encrypted package.
- **Key management** — generate, import, inspect, or export keys as supported.
- **Transfers** — optional history/status view if the product implements server-backed transfers.
- **Settings** — theme and relevant application preferences, if supported.

Do not display links to unfinished functionality. If SealBox only encrypts and decrypts locally, do not imply that cloud transfers or transfer history exist.

---

## 6. Core Screens

### 6.1 Landing page

**Purpose:** explain SealBox and direct the user to the core workflow.

Recommended section order:

1. **Header:** SealBox wordmark, concise navigation, and one primary action.
2. **Hero:** a direct headline such as “Send files securely.” Short copy should explain that files are encrypted before transfer only if that is how the implementation actually works.
3. **Primary action:** “Encrypt a file” with a secondary “Decrypt a file” action.
4. **How it works:** three steps—choose file and recipient key, encrypt, then share the encrypted package.
5. **Security explanation:** describe the actual encryption workflow in plain language without exaggerated claims.
6. **Footer:** brief product information, privacy/security details, and help links that exist.

Avoid a wall of feature cards. The file workflow should remain the most prominent part of the page.

### 6.2 Encrypt file

**Purpose:** guide the sender through creating an encrypted package.

Recommended component order:

1. Page title and a one-sentence explanation.
2. Drag-and-drop file panel with a “Choose file” button.
3. Selected-file summary showing file name, size, and remove/replace action.
4. Recipient public-key selector or import control.
5. Key identity/fingerprint confirmation when available.
6. Primary “Encrypt file” action.
7. Progress, result, and error feedback.
8. On success, show the encrypted package details and the supported download/transfer action.

**Upload panel behavior:**

- Clearly indicate allowed file types and maximum size if restrictions exist.
- Support keyboard activation of the file picker.
- Display rejected-file reasons in plain language.
- Show a visible selected state and a clear way to replace/remove the file.
- Never begin uploading plaintext to the backend if the architecture promises client-side encryption.

### 6.3 Decrypt file

**Purpose:** help the recipient recover the original file.

Recommended component order:

1. Page title and a short explanation.
2. Encrypted-package picker.
3. Private-key import/selection control, based on the implemented key-storage model.
4. Passphrase field only when required by the private-key format; explain its purpose.
5. Primary “Decrypt file” action.
6. Verification/decryption status.
7. Successful result with original file name if safely available and a download action.

Keep private-key guidance explicit. Do not request that users paste private keys into chat, send them to a recipient, or upload them to a server unless the product's architecture deliberately requires server-side custody and discloses that risk.

### 6.4 Key management

Include this screen only if key management is part of the product scope.

- Separate **Public key** and **Private key** sections visually and linguistically.
- Explain that a public key can be shared, while a private key must be kept secret.
- Label every import/export operation clearly.
- Show a fingerprint or other stable identifier when supported.
- Provide warnings before exporting sensitive key material.
- Never imply that a public key is verified unless the application actually verifies its identity or the user confirms its fingerprint through a trusted channel.

### 6.5 Transfer history

Include only if server-backed transfers are implemented.

- Show file/package name, creation date, transfer status, expiry (if supported), and available actions.
- Avoid exposing plaintext file contents or private-key material.
- Make deletion and expiry behavior clear.
- Provide empty, loading, failure, and populated states.

---

## 7. Core Components

### Buttons

- **Primary:** solid blue background with white text; use for the main action in a section.
- **Secondary:** white or muted surface with a neutral border.
- **Tertiary:** text or subtle-background action for low-priority controls.
- **Destructive:** red treatment reserved for irreversible or dangerous actions.

Use concise verbs such as “Choose file,” “Encrypt file,” “Decrypt file,” “Download package,” and “Remove file.” Avoid ambiguous labels such as “Go” or “Submit” when the action can be named directly.

### Inputs and selectors

- Always pair controls with visible labels.
- Use placeholder text only as an example, not as the sole label.
- Provide an inline description for public/private-key fields where needed.
- Show validation errors beside the relevant control and explain how to resolve them.
- Preserve entered values after recoverable validation errors.

### Cards and panels

- White surface, 1px neutral border, 10–14px radius.
- Use cards for meaningful groups, not every individual text element.
- Keep padding consistent within the same card type.

### File drop zone

- Use a dashed neutral border; change border and background subtly on hover, drag-over, and focus.
- Show a simple upload/file icon, a short instruction, and a visible browse button.
- Distinguish drag-over, valid selection, invalid selection, and disabled states.

### Status feedback

Provide explicit states for:

- Ready for file selection.
- File selected and validated.
- Key missing or invalid.
- Encrypting or decrypting.
- Operation completed successfully.
- Invalid package or authentication verification failure.
- Unsupported file, file too large, or insufficient memory.
- Unexpected application or network error.

Use a short title plus a practical next step. Never report successful encryption/decryption before the operation actually succeeds.

### Dialogs and confirmations

Use a dialog for destructive actions, important key-export warnings, or decisions that require user attention. Do not put routine informational content in a modal.

---

## 8. Interaction and Motion

- Hover and focus treatments should be restrained and predictable.
- Standard transitions: approximately 120–180ms for color, border, or opacity changes.
- Respect `prefers-reduced-motion`.
- Do not use animation to simulate cryptographic work or imply stronger security.
- Disable duplicate submissions while an operation is genuinely in progress, and explain the current state.
- Never leave the interface permanently disabled after an error; provide a recovery action.
- Preserve keyboard focus sensibly when dialogs open/close or content updates.

---

## 9. Responsive Behavior

### Desktop

- Use a centered content area with a clear page heading.
- Keep the encryption workflow focused and avoid overly wide form controls.
- If secondary explanations appear beside the workflow, ensure the primary action remains visually dominant.

### Tablet

- Reduce horizontal gaps and allow secondary panels to move below the main workflow.
- Keep buttons and inputs comfortably sized.

### Mobile

- Use a single-column layout.
- Make the primary action full width where helpful.
- Stack file details and key-selection controls vertically.
- Avoid fixed-width cards and dense multi-column metadata.
- Ensure the file picker, dialogs, and passphrase fields fit within the viewport.
- Keep important warnings visible without requiring horizontal scrolling.

---

## 10. Accessibility Requirements

- Target WCAG 2.2 AA contrast requirements for text and interface controls.
- Support all essential actions with a keyboard.
- Make focus indicators visible and consistent.
- Use semantic headings in order and real labels for form controls.
- Associate validation text and descriptions with their inputs.
- Announce important progress and completion messages to assistive technology where appropriate.
- Provide accessible names for icon-only controls.
- Do not rely on color, animation, or icon shape alone to express a status.
- Ensure zoom and text resizing do not hide essential controls or content.

---

## 11. Security-UX Requirements

The interface must accurately describe what the implementation does.

- Do not claim “end-to-end encrypted,” “encrypted locally,” “zero knowledge,” or “private keys never leave your device” unless the architecture and implementation support those statements.
- If encryption occurs in the browser, explain when the file is encrypted relative to upload.
- If the backend stores encrypted packages, distinguish encrypted file content from visible metadata such as file name, size, account identifiers, timestamps, or IP logs.
- Clearly distinguish encryption from digital signatures. Encryption for a recipient does not, by itself, prove who sent a file.
- Explain the consequences of losing a private key; encrypted data may become unrecoverable.
- Avoid logging file contents, private keys, passphrases, or other secret values.
- Explain what happens when a transfer expires or is deleted, and do not promise deletion from every location unless the system can guarantee it.

**Cryptographic note:** UI design does not validate the cryptographic implementation. The application should use maintained, standards-based cryptographic primitives and have its key handling, nonce generation, authentication checks, and error handling reviewed separately.

---

## 12. Suggested Microcopy

Use plain, specific language.

| Situation | Suggested copy |
|---|---|
| Empty file picker | “Choose a file to encrypt” |
| File selection helper | “Select a file from your device. File-size limits apply.” |
| Public-key selector | “Recipient’s public key” |
| Public-key helper | “Use the recipient’s verified public key.” |
| Private-key selector | “Your private key” |
| Private-key helper | “Keep your private key secret. It is required to decrypt files addressed to you.” |
| Encryption action | “Encrypt file” |
| Decryption action | “Decrypt file” |
| In progress | “Encrypting file…” or “Verifying and decrypting…” |
| Success | “Encryption completed. Your encrypted package is ready.” |
| Authentication failure | “The file could not be verified or decrypted. Check the package and private key.” |
| Key mismatch | “This private key could not decrypt the package. Check that it belongs to the intended recipient.” |
| Invalid file | “This file type or package format is not supported.” |
| Generic failure | “Something went wrong. Try again. If the problem continues, review the file and key details.” |

Only show a message if its meaning matches the actual system behavior.

---

## 13. Implementation Guidance

- Store design tokens centrally using CSS custom properties or the project's existing theme system.
- Build reusable components for buttons, text fields, file drop zones, cards, status messages, and dialogs.
- Use a consistent spacing and typography scale rather than arbitrary values on each page.
- Use the existing framework, routing, and component conventions where a codebase already exists.
- Avoid adding dependencies solely for minor visual effects.
- Keep cryptographic functionality independent from presentation components so it can be tested separately.
- Do not mark an interaction as functional until it is connected to real application logic.
- Keep the visual design independent of whether a user is on desktop or mobile; adjust layout, not the underlying information hierarchy.

---

## 14. Definition of Done

The design is ready for review when all applicable criteria pass:

### Visual consistency
- [ ] Colors, typography, spacing, borders, radii, and icons follow the token system.
- [ ] Primary actions are visually obvious and used consistently.
- [ ] Pages have clear hierarchy without excessive decoration.
- [ ] No arbitrary one-off component styles remain without a reason.

### Functionality and states
- [ ] File selection, removal, validation, and primary actions work.
- [ ] Loading, success, and failure states are designed and tested.
- [ ] Key-related controls clearly differentiate public and private keys.
- [ ] No security success message is displayed before actual success.
- [ ] Unimplemented features are not displayed as available features.

### Responsiveness and accessibility
- [ ] Desktop, tablet, and mobile layouts have been reviewed.
- [ ] No horizontal overflow occurs at supported viewport sizes.
- [ ] Keyboard navigation and visible focus states work.
- [ ] Form errors and status updates are understandable and accessible.
- [ ] Contrast and text resizing have been checked.

### Security communication
- [ ] Security claims match the implementation.
- [ ] Plaintext, private keys, and passphrases are not inadvertently exposed by the UI or logs.
- [ ] The product explains key-loss and verification-failure outcomes clearly.

---

## 15. Design Summary

SealBox should use a restrained, light-first SaaS design built around a single clear file workflow. Off-white backgrounds, charcoal text, fine grey borders, blue interaction accents, consistent line icons, and generous but purposeful whitespace should establish the visual identity. Security explanations should be plain, precise, and tied to the actual implementation. The interface should make encryption understandable without making exaggerated security promises.
