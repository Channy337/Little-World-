# Civorian Jarvis profile specification

Status: owner-selected next feature after the V0.8 production release. Implementation has not started. Any connected coding assistant must fetch current `main`, read `AGENTS.md` and `HANDOFF.md`, and verify open PRs before acting.

## Delivery boundary

- Start from current production `main`, not the old V0.8 preview branch.
- Create `beta/civorian-jarvis-profile` unless that branch already exists; if it exists, inspect and continue it safely.
- Open a separate draft PR. Do not modify the merged PR #22.
- Do not merge, production-deploy, reset data, or alter production without new explicit owner approval.
- Draft PR #23 is older stacked shelter work. Do not merge it independently or copy it blindly.

## Objective

Build a polished, futuristic, visitor-facing Civorian Life Profile. Clicking a Civorian should let a visitor understand that individual's body, mind, knowledge, relationships, possessions, experiments, discoveries, capabilities and life history.

This is an observation interface, not a control panel. It must remain read-only and must not advance time, perform actions, teach knowledge, edit a mind, or write canonical state.

Inspect the existing life drawer before choosing the smallest coherent implementation: expand it, add a full-screen overlay, add a dedicated profile page, or combine a quick drawer with a deeper profile. Support desktop and mobile.

## Knowledge boundary

The interface must clearly separate:

1. **Civorian knowledge** — what this individual sensed, was told, believes, suspects, remembers, demonstrated or personally reproduced.
2. **Observer analysis** — physical state the deterministic engine knows and may explain to visitors.

Observer analysis must never be written into the Civorian's memories, beliefs, vocabulary, conversations, AI prompts or executable capabilities.

For example, a visitor may see `dehydration`, while the Civorian may know only “my mouth is dry and I feel weak.” A visitor may see a hidden toxic effect, while the Civorian remembers only that eating a particular-looking leaf caused pain. Incorrect beliefs remain beliefs; the UI must not silently correct them.

Never turn civilization-wide knowledge into personal knowledge. Never reveal unseen places or modern scientific labels to a Civorian because another person or the interface knows them.

## Visual direction

Use a Jarvis-inspired visual language without copying Iron Man artwork, names or copyrighted interface assets:

- dark translucent surfaces;
- blue/cyan analytical accents;
- a prominent animated Civorian avatar;
- subtle scanning and data-motion effects;
- crisp, readable panels;
- accessible contrast and keyboard behavior;
- reduced-motion support;
- responsive mobile layout;
- visual continuity with Civoria's existing world presentation.

Prefer useful clarity over ornamental animation.

## Profile content

Display only data supported by canonical state or safe derivation. For absent legacy fields, omit the field or show `Unknown` / `Not yet recorded`; do not fabricate a fuller biography.

### Overview

- avatar, name, living/deceased state;
- age, biological age and life stage;
- sex when canonically present;
- current location and action;
- immediate condition;
- parents, children and caregivers;
- personally chosen symbols or identifiers when available.

### Appearance and inheritance

Show visible inherited traits and family resemblance when present. All Civorians are one human species. Do not create a race behavior category or connect appearance to intelligence, morality, personality, creativity, motivation, profession or technological ability. Modern racial labels are not automatic world knowledge.

### Body

Use existing canonical biology at honest precision:

- health, hydration, hunger, energy and stored fuel;
- fat and muscle condition when available;
- temperature, pain, wounds, bleeding and infection;
- smoke exposure and oxygen condition;
- sleep pressure, debt and alertness;
- pregnancy and life-stage status;
- immediate survival risks.

Clearly distinguish raw canonical values from visitor-friendly interpretations. Do not imply medical detail the simulation does not model.

### Mind

- current thoughts, goals, fears and emotions;
- curiosity and motivation;
- beliefs and hypotheses, including incorrect ones;
- significant memories and recent observations;
- current investigation;
- personal relationships.

Label the evidence state where possible: observed, believed, suspected, told by another, demonstrated, personally reproduced or unconfirmed.

### Personal knowledge

- directly observed objects and events;
- remembered or communicated locations;
- witnessed demonstrations;
- attempted and reproduced methods;
- known words and symbols;
- readable records;
- knowledge taught to others.

### Capabilities

Do not add an RPG skill tree, profession levels or named technology unlocks. Show physical evidence instead:

- attempts and successful outcomes;
- repeated matching results;
- materials and processes used;
- personally reproducible methods;
- heard instructions not yet reproduced;
- demonstrations and learners;
- dangerous or failed methods.

### Experiments and discoveries

When records exist, show the causal chain:

1. observation;
2. hypothesis;
3. materials;
4. physical action;
5. time and energy cost;
6. outcome, failure or injury;
7. repeated result;
8. personal capability;
9. transfer to other people;
10. living holders or knowledge loss.

Never display automatic messages such as `Farming unlocked` or `Aircraft unlocked`. If flight ever develops, visitors should see the real prototypes, forces, materials, failures and reproducible construction that caused it.

### Inventory and artifacts

Show canonical food, water, seeds, raw materials, tools, clothing, records, experiment parts, completed artifacts and stored possessions. Allow visitors to inspect visible material and mechanical properties when available. Molecular composition remains unavailable to the Civorian without adequate instruments and evidence.

### Relationships

Show family ties that can be safely derived and social ties recorded by real interactions: caregivers, friends, teachers, learners, collaborators, rivals, trust and fear. Do not invent narrative labels.

### Life timeline

Build the timeline only from recorded events: birth, caregivers, memories, injuries, illness, close calls, relationships, experiments, discoveries, failures, inventions, knowledge transfer, records, children and death. Preserve deceased profiles when canonical history permits it.

## Discovery-map connection

Connect a person's experiment or discovery to the existing visitor discovery graph when the architecture permits. Visitors should eventually trace who observed, reproduced, taught, recorded and retained a capability. The graph records actual Civorian history; it must never prescribe a human technology sequence.

## Architecture rules

- The deterministic server remains authoritative.
- The browser remains read-only.
- Add no browser state-write route and no canonical `localStorage` authority.
- Opening or viewing a profile must not advance simulation time.
- Never add observer truth to AI prompts.
- Never globalize personal knowledge.
- Preserve old-save compatibility and bounded histories.
- Preserve the active V2 production namespace and previous V1 data.
- Keep presentation separate from simulation.
- If the UI needs additional data, expose the smallest safe read-only projection of existing canonical state. Do not expand simulation behavior merely to fill a panel.

## Verification

Tests must establish:

- clicking a Civorian opens the correct profile;
- missing legacy fields are safe;
- living and deceased states render safely;
- personal and global knowledge remain distinct;
- observer analysis is visually separated from Civorian knowledge;
- hidden scientific labels do not enter AI prompts;
- the profile has no canonical write path and does not advance time;
- no new browser persistence authority is introduced;
- old saves still load;
- mobile layout and reduced-motion behavior work;
- every referenced profile asset ships in the public build;
- the full existing suite and production build pass.

Perform a hosted visual check on the draft preview. Record any limitation honestly.

## Required handoff

Before stopping, update `HANDOFF.md` and push the checkpoint. Record:

- assistant and UTC timestamp;
- branch and exact commit;
- draft PR and preview URL;
- what was implemented;
- tests, build and visual-check results;
- known limitations;
- unfinished work;
- exact next action and any owner decision required.

The next connected assistant will read GitHub, not the previous assistant's private chat. A local-only note is not a handoff.
