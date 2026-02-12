Design & Implementation Overview

I began the assignment by carefully reviewing each provided HTML form (Acme, Globex). Instead of immediately writing automation logic, I first analyzed the DOM structure, required fields, conditional sections, multi-step navigation, sliders, file uploads, and validation behavior.

The goal was to understand:

What logic is common across forms?

What differs between ATS systems?

How can this be designed in a scalable way rather than hardcoded?

From this analysis, I designed an adapter-based architecture to keep the system extensible and maintainable.

Code Structure & Why It Was Designed This Way

The project is structured around independent ATS adapters, a central registry, a reusable core utilities layer, and a main automation runner.

Each ATS form has its own adapter class:

AcmeAdapter

GlobexAdapter

DroprAdapter

TsentaAdapter

All adapters implement a shared interface with two responsibilities:

canHandle(page) → determines if the adapter supports the current page

apply(page, profile) → executes the complete automation flow

This structure was chosen because:

It prevents large conditional logic blocks.

Each ATS remains isolated and easier to debug.

Adding a new ATS only requires creating a new adapter and registering it.

The core automation logic remains clean and reusable.

The registry.ts file maintains a list of adapters. The automator.ts iterates through this registry and selects the correct adapter dynamically. This makes the system plug-and-play and open for extension without modifying existing adapters.

Core Utilities Layer

A core/ folder was created to separate reusable automation utilities from ATS-specific business logic.

It includes:

human.ts → human-like typing, scrolling, hover-before-click, and reading pauses to reduce flaky behavior.

retry.ts → retry wrapper with exponential backoff and jitter for unstable async interactions.

logger.ts → structured logging using info() to improve observability.

template.ts → template rendering for dynamic content like cover letters.

match.ts → value mapping utilities.

This separation keeps adapters focused only on form-specific logic and improves overall maintainability.

Dynamic Template Improvement

Initially, the cover letter inside profile.ts contained a hardcoded company name (“Acme”). This caused incorrect company names to appear when automating other forms.

To fix this, I replaced the static value with a placeholder:

{{company}}


Each adapter now renders the template dynamically:

renderTemplate(profile.coverLetter, { company: "Globex Corporation" })


This ensures the correct company name appears for each ATS without duplicating profile data.

Technical Challenges & Hardest Part

The most technically challenging part was handling complex UI elements and ensuring correctness under dynamic behavior.

One example was the Globex salary slider. When setting a value such as 85000, the slider would sometimes round incorrectly (e.g., 80000) due to internal step snapping logic.

To solve this:

I calculated min, max, and step values directly from the DOM.

Manually snapped the salary to the nearest valid step.

Triggered both input and change events.

Verified the final value after setting it.

Threw an error if the expected value did not match the actual value.

This ensured the automation was deterministic and prevented silent failures.

Handling async typeahead fields was another challenge. To address flakiness, I implemented a retry mechanism with exponential backoff.


Bonus Enhancements

To improve robustness and demonstrate automation correctness, I implemented:

Structured logging for key automation steps.- for dropr and tsenta

Retry logic for flaky async interactions. - in dropr and globex(while entering university)

Human-like delays and hover-based interactions.

End-to-end Playwright tests verifying:

Success state visibility

Confirmation ID format

Salary correctness (regression test)

Execution time measurement per form submission.

Automatic screenshot capture on success and failure.

Storage of screenshots in a dedicated screenshots/ directory for debugging.

These improvements increase reliability and debuggability beyond basic automation.

AI Tools / Assistants Used
    Chat gpt and claude -problem statement, solution,doc reference for playwright,optimal roadmap, discusions , code generation ,implementation 