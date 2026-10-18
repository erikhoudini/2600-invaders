# Public Participation Terminal — Product Design Document

- **Platform:** Nintendo DS / Nintendo DSi, with DSi XL as the preferred deployment device
- **Product category:** Offline public-participation appliance
- **Core modes:** Vote, Suggest, Comment
- **Primary environment:** Cafés, bars, bookstores, community spaces, and other public-facing third places
- **Operating model:** Permanently deployed, locally administered, independent of a computer or internet connection

## 1. Product Vision

The Public Participation Terminal turns a Nintendo DS into a small, dedicated public interface through which visitors can participate in the life of a shared space.

A visitor approaches the device, sees a question or invitation, and can vote, suggest an idea, or leave feedback. The experience should feel immediate, tactile, inviting, and a little delightful. The owner or staff member can configure questions, inspect responses, manage records, and adjust the application directly on the same device.

The product is not simply a polling application. It is a small piece of participatory infrastructure: a persistent point of contact between a venue and the people who use it.

A café might ask which seasonal drink customers would prefer. A bar might solicit ideas for future events. A bookstore might invite suggestions for its next group reading. A community space might collect opinions about programming or improvements. These are examples of the intended use, not predefined limitations on the kinds of questions the application can support.

The terminal should make participation a natural part of being in a place, rather than something that requires a visitor to find a website, scan a QR code, install an app, or hand over personal information.

### 1.1 The central idea

A Nintendo DS becomes a dedicated object with a social purpose.

The hardware is not merely a small screen on which to run a generic survey interface. Its physical form, two displays, touchscreen, stylus, portability, and ability to remain on a counter are part of the product.

The application and the object reinforce each other. A DSi XL placed beside a café register becomes the venue's participation terminal in much the same way that a clipboard can become the venue's sign-up station.

### 1.2 Product principles

1. **Participation should be effortless.** A visitor should understand what to do without reading a manual or receiving an explanation from staff.
2. **The terminal belongs to the venue.** It should retain a stable identity even as individual polls and questions change.
3. **The public experience is the primary interface.** Visitors should encounter the participation experience immediately, not an operating system, launcher, file browser, or administrative menu.
4. **The device must be self-sufficient.** Routine operation, configuration, review, and maintenance must be possible on the DS itself.
5. **The application works offline.** Participation and administration must not depend on an internet connection, account, cloud service, or remote dashboard.
6. **Results should be meaningful, not merely decorative.** Display aggregate counts as well as percentages, preserve historical records, and avoid presenting small samples as more conclusive than they are.
7. **The visual experience should invite interaction.** Use color, illustration, and animation to give participation a sense of occasion without sacrificing clarity.
8. **The hardware's limitations are design constraints.** Screen size, touch input, text-entry speed, storage reliability, and available processing power should shape the application from the beginning.

## 2. Intended Deployment

The terminal differs from a task-oriented utility that is brought out, used, and put away. It is intended to remain in a fixed location for extended periods.

The owner configures it, connects it to power, places it on the counter, and leaves it available to visitors. The application should continue to present its public interface without requiring routine intervention.

### 2.1 Preferred hardware

The Nintendo DSi XL is the preferred deployment target because its larger screens are better suited to public-facing use. Standard DS and DSi hardware may also be supported where practical.

The initial product should work with ordinary console hardware, a charger, and a stylus. A custom enclosure or specialized physical modification is not a prerequisite.

A stand, tethered stylus, or other installation accessory may be considered later, but these are physical deployment enhancements rather than requirements for the initial software.

### 2.2 Typical operating environment

The device may sit on a café counter, bar, bookstore desk, library table, or community-space reception counter. Visitors may approach it for only a few seconds. They may be unfamiliar with the software and may not have used a Nintendo DS before.

The application therefore needs to be immediately legible, resilient to interrupted interactions, and safe to leave unattended.

It should not rely on audio to communicate. Sound should be disabled by default, and the interface should remain fully understandable in a noisy venue or a quiet one.

### 2.3 Public and administrative use

There are two distinct operating contexts:

- **Public mode:** Visitors vote, suggest, and comment. Administrative functions are inaccessible.
- **Administrator mode:** The owner or authorized staff member configures the terminal, manages active polls, reviews feedback, inspects results, and manages stored records.

The transition between these contexts must be deliberate and protected by a PIN.

## 3. Product Scope

The application has three primary public-facing modes.

### 3.1 Vote

Visitors answer a poll configured by the owner. A poll can present two or four choices, with a visual layout appropriate to the number of options.

Examples include choosing between two seasonal drinks, selecting a preferred event theme, or choosing among four proposed activities.

The poll should be the most prominent public interaction. Its question appears on the upper screen; the answer controls appear on the lower touchscreen.

Results remain hidden until the visitor has selected an answer and confirmed it. The application then presents a results reveal, including a graph and the underlying vote totals.

### 3.2 Suggest

Visitors submit short free-text ideas or requests.

Examples include suggesting a new drink, proposing an event, recommending a book, or requesting a change to the venue.

Suggestions are stored locally for the owner to review. They are not automatically displayed to other patrons.

Text entry must accommodate the DS touchscreen and stylus. Because entering text on the DS is slower than on a modern phone or computer, the interaction should encourage concise submissions rather than long essays.

A proposed initial character limit is 200 characters. The final limit remains a design decision to validate against the keyboard layout and intended use.

### 3.3 Comment

Visitors provide structured feedback through predefined choices, such as:

- Good / Okay / Not great
- Yes / No
- Other short, owner-configured sets of responses

Comment is intended for quick reactions and feedback, not long-form writing. It should be distinguishable from both voting on a particular question and submitting an open-ended suggestion.

The administrator should be able to configure which structured feedback prompts are available. The exact range of supported prompt types and response sets remains to be finalized.

## 4. Public Experience and Interaction Model

The public interface should be a continuous experience, not a menu of application functions.

The terminal can invite visitors to participate while still making the primary action obvious. Vote should dominate the screen when an active poll is available, while Suggest and Comment remain accessible as secondary options.

### 4.1 Dual-screen responsibilities

The two screens should have distinct roles.

**Upper screen — presentation and context.** The upper screen tells the story of the current interaction. It presents the active question, supporting illustration, confirmation context, or results.

**Lower screen — input and action.** The lower screen is the visitor's working surface. It presents answer buttons, text-entry controls, structured feedback choices, and confirmation controls.

This division should remain consistent throughout the application. Visitors should not need to guess which screen to use.

### 4.2 Public landing and idle state

When the device is ready for use, it should display a welcoming public-facing state that makes the terminal's purpose clear.

The idle presentation should communicate that visitors can participate. It may use a restrained animation, an illustrated character, a rotating visual element, or another distinctive visual cue.

It should not become a screensaver that hides the application's purpose. The invitation to participate must remain apparent.

When an active poll is available, the landing state should make that poll easy to discover. Vote, Suggest, and Comment should remain recognizable functions.

The precise idle layout and the timing of any return to it are unresolved. They should be tested in the actual public setting.

### 4.3 Voting flow

The intended sequence is:

1. **Present the question.** The upper screen displays the question and its illustration. The lower screen displays the answer choices.
2. **Choose an answer.** The visitor taps one of the large answer buttons.
3. **Confirm the choice.** The interface shows the selected answer and offers a clear way to confirm or change it.
4. **Record the vote.** Only the confirmed choice is committed to the poll's results.
5. **Reveal the results.** The upper screen transitions into a graph or other visual result presentation.
6. **Return to public use.** After the results presentation, the terminal returns to a state ready for the next visitor.

The confirmation step should be enabled by default. It gives the visitor an opportunity to catch accidental taps and gives the final action a little weight.

The result reveal should feel satisfying and visually distinctive, taking inspiration from the playful presentation of Nintendo's Everybody Votes Channel without directly copying its characters or interface.

### 4.4 Results visibility

Results are hidden before the visitor submits a vote.

This is an intentional product decision. Showing existing results before a person answers could influence their choice and encourage bandwagon behavior.

The visitor sees the results after confirming a vote. The first version should not add a public, pre-vote results browser unless the product direction is deliberately revised.

After the reveal, the application should return to public mode. The exact timing and whether a visitor can dismiss the reveal early remain to be determined.

### 4.5 Answer-button layout

The touchscreen should use large, clearly separated controls.

For a two-option poll, the choices should occupy most of the lower screen in a simple side-by-side arrangement.

For a four-option poll, use a two-by-two grid.

Suggest and Comment should be accessible as smaller secondary controls below or alongside the main voting area, as screen geometry permits.

The primary poll choices should have the greatest visual weight. Secondary controls must remain easy to find without competing with the question.

The final spacing, labels, and button dimensions should be validated on the physical DS screens, not only in a desktop browser.

### 4.6 Suggestion flow

1. The visitor selects Suggest.
2. The upper screen explains the immediate task and may show a small contextual illustration.
3. The lower screen presents a text-entry interface.
4. The visitor enters a short suggestion.
5. The visitor reviews and submits it.
6. The terminal acknowledges receipt with a brief, visually warm confirmation.
7. The interface returns to public use.

The application should not require a name, email address, phone number, or other personal identifier by default.

Text-entry recovery must be considered. If the visitor accidentally backs out, the software should avoid losing entered text without warning when practical.

### 4.7 Comment flow

1. The visitor selects Comment.
2. The application presents the current feedback prompt and its structured response options.
3. The visitor chooses a response.
4. The application records the response and acknowledges submission.
5. The interface returns to public use.

The Comment mode should be optimized for quick, low-effort feedback. It should not become a generic form builder that makes every interaction cumbersome.

### 4.8 Interrupted interactions

A public terminal is likely to experience interruptions: visitors may walk away, tap the wrong button, close the console, or abandon a partially completed suggestion.

The application should distinguish between an interaction in progress and a completed submission.

Unconfirmed votes must not count. Partially entered suggestions must not be recorded as completed submissions. If an interaction is abandoned, the terminal should eventually return to its public-ready state.

The timeout duration is unresolved and should be configurable or chosen after testing. The reset must not interrupt a visitor so quickly that ordinary use becomes frustrating.

## 5. Results Presentation

The results reveal are a major part of the product's identity. They should make the act of participating feel tangible and collective.

A graph alone is functional but not necessarily memorable. The visual treatment can give the reveal a sense of personality while preserving accurate numbers.

### 5.1 Information that must be displayed

Results should show both the percentage and the raw number of votes for each answer.

For example:

- 46% — 13 votes
- 32% — 9 votes
- 22% — 6 votes

The example is illustrative, not a fixed poll result.

Percentages alone can mislead when a poll has received only a few responses. Showing the raw count helps visitors understand the size of the sample.

The graph should also make the answer labels clear. Colors and illustration may reinforce the data but must not replace labels or numbers.

### 5.2 Graph design

Animated horizontal bars are a practical starting point, particularly for four-option polls. They are easy to compare and can be rendered clearly at DS resolution.

A pie chart or another illustrated visualization could be explored if it remains legible and communicates proportions accurately. The final chart type is not settled.

The results transition should be animated, but the animation should not delay access to the information unnecessarily. The complete result should become readable quickly, even if a visitor does not watch the entire reveal.

### 5.3 Original illustrated elements

The application may use a small set of original, stylized figures, symbols, or pictograms to represent participation and add personality to the results.

These elements should not imitate Miis or reproduce Everybody Votes Channel's artwork. The goal is to take inspiration from the channel's sense of playfulness, not copy its intellectual property.

Illustrations should use simple silhouettes and a limited number of frames, suitable for the DS's display and processing constraints. They should support the information rather than obscure it.

Any animated representation of votes must remain clearly decorative unless it accurately reflects the recorded data. The application should not imply a precise number of individual participants when the animation is merely symbolic.

### 5.4 Poll sample size and interpretation

The terminal records responses; it does not establish that every response comes from a different person.

The application should not claim that the poll represents all patrons or that one vote corresponds to one unique visitor. The unattended device cannot reliably enforce one vote per person.

The interface can present the results as participation totals without making stronger claims about representativeness.

## 6. Visual Identity and Art Direction

The participation terminal should have a visual identity distinct from the other DS utilities, Clipboard and Count.

Those applications favor a restrained, practical, paper-like visual language. The participation terminal should be more colorful, expressive, and animated because its job is to invite people into a social interaction.

It should still share the family's broader commitment to clarity, tactile controls, minimal friction, and purposeful design.

### 6.1 Desired character

The experience should be:

- Colorful and inviting.
- Playful without feeling like a children's educational game.
- Distinctive enough to be recognizable as a dedicated venue appliance.
- Legible at low resolution and from ordinary counter-use distances.
- Warm and human without relying on large amounts of explanatory text.
- Consistent across polls, suggestions, comments, and administration.

### 6.2 Color

A proposed starting palette is:

- Marigold — `#F4B544`
- Coral — `#EE6B55`
- Sea glass — `#57AFA0`
- Periwinkle — `#697BC3`
- Vanilla paper — `#FFF4DB`
- Ink — `#34343F`

These are initial art-direction suggestions, not a finalized palette. The colors should be tested on the actual DS displays and checked for adequate contrast.

Color should serve a purpose: distinguishing options, giving the application a recognizable personality, and making the result graph easy to read. It should not become decoration that competes with the question or response.

### 6.3 Typography and text

The application should use large, legible text and short labels. The upper screen must accommodate questions that vary in length, while the lower screen must leave enough space for touch controls.

Avoid long instructions, redundant status messages, and repeated explanations of actions that are already obvious from the interface.

The public-facing experience should use concise, natural language. The owner should not need to write a paragraph to explain how to vote.

### 6.4 Animation

Animation should communicate a state change or add personality to the experience.

Appropriate uses include:

- A tactile button-press response.
- A transition from a selected answer to confirmation.
- An animated results graph.
- A brief visual acknowledgment after a suggestion or comment is submitted.
- A restrained idle animation that invites participation.

Animation should not block input unnecessarily, make the terminal appear unresponsive, or interfere with reading results.

Sound is not required. The terminal should be enjoyable and understandable with audio disabled.

## 7. Administrator Experience

The application must be fully operable and configurable on the DS itself.

This is a core requirement, not a future convenience. The owner should not need to connect a computer merely to change a poll, read a suggestion, view results, or change settings.

The computer is primarily for backup, export analysis, and optional external handling of the data.

### 7.1 Access control

Administrative functions must be protected by a PIN.

The public interface should not display an obvious administrator button or provide patrons with a route into administrative screens. A discreet gesture or button combination can open the PIN prompt.

After successful authentication, the administrator enters a dedicated management interface. After a period of inactivity, the application should return to public mode and relock administration.

The PIN protects against casual access by visitors; it is not a substitute for physical security or encryption against someone with direct access to the SD card.

### 7.2 Administrator home

The administrative interface should organize tasks into clear sections rather than presenting a long, undifferentiated list of settings.

Proposed sections:

1. Poll Manager
2. Feedback Inbox
3. Results and History
4. Appearance and Behavior
5. Records and Storage
6. Terminal Settings

The exact menu hierarchy and number of screens remain to be refined against the lower screen's physical dimensions.

### 7.3 Poll Manager

The owner should be able to:

- Create a poll.
- Edit a draft poll.
- Configure its question and answer choices.
- Choose between two and four answer options.
- Preview how the poll will appear to visitors.
- Activate a poll.
- End or deactivate an active poll.
- Archive old polls.
- Review past poll results.

Editing a poll after votes have been recorded must not silently rewrite the meaning of historical responses. The implementation should preserve the original poll definition and results, for example by creating a new revision or a new poll identity when the question or choices change.

A poll with existing votes should require a clear, deliberate action before any operation that would invalidate or reset those results.

The ability to have one active poll at a time is a sensible initial operating model, but it should be confirmed as a product requirement before implementation.

### 7.4 Feedback Inbox

The owner must be able to read and manage suggestions and comments on the device.

The inbox should support practical actions such as:

- Browse submitted feedback.
- Read a full submission.
- Review feedback without changing its content.
- Mark an item as reviewed.
- Archive an item.
- Delete an item through an explicit action.

If the inbox contains many submissions, basic filtering or sorting may become useful. The first implementation should prioritize dependable browsing and reading over a complex search system.

Suggestions and comments should remain private to the administrator unless the owner explicitly exports or otherwise handles them. They should not appear automatically on the public screen.

### 7.5 Results and History

The owner should be able to inspect completed polls and their results without connecting a computer.

The historical view should preserve the question, answer labels, counts, percentages, and relevant dates or timestamps. It should distinguish archived polls from the currently active poll.

Historical results must remain interpretable even after the owner creates a new poll with similar wording.

### 7.6 Appearance and Behavior

The owner should be able to configure the public experience on the DS itself.

Potential settings include:

- Theme or color treatment.
- Illustration or visual style, where alternatives are implemented.
- Idle presentation and animation behavior.
- Which public modes are enabled.
- Public-session timeout behavior.
- Relevant display or interaction preferences.

The first release does not need a large collection of themes. The important requirement is that supported settings be accessible and manageable without a computer.

### 7.7 Records and Storage

The owner should be able to inspect local storage status and manage records.

This area should provide clear access to:

- Historical data.
- Archived polls.
- Stored suggestions and comments.
- Export functions.
- Storage availability or capacity warnings.
- Data recovery or reset actions where implemented.

The interface must distinguish archiving from deletion. Destructive actions should explain what will be lost and require deliberate confirmation.

A single vague "clear everything" action should not be the normal way to manage data.

### 7.8 Terminal Settings

The owner should be able to manage the PIN, inactivity behavior, and other operational settings.

The settings should also include a deliberate way to end or reset an active public session when necessary.

A forgotten-PIN recovery procedure must be designed before release. It should be documented and should not expose an obvious public bypass.

The exact recovery procedure is unresolved.

## 8. Data Model and Local Storage

The application is designed for offline use. Polls, votes, suggestions, comments, settings, and historical records are stored locally.

There should be no dependency on a cloud account, remote database, web service, or internet connection.

### 8.1 Data categories

The local data model should distinguish at least the following categories:

**Terminal configuration**
- Public interface settings.
- Enabled modes.
- PIN-related security data.
- Idle and timeout behavior.
- Current active-poll reference.

**Poll definitions**
- Poll identity.
- Question text.
- Answer choices.
- Creation and activation information.
- Status and revision information.

**Poll results**
- Poll identity and applicable revision.
- Recorded response counts.
- Relevant timestamps or dates.
- Historical and archived status.

**Suggestions**
- Suggestion text.
- Submission timestamp, if available.
- Review status.
- Archive or deletion status.

**Comments**
- Prompt identity or text.
- Selected response.
- Submission timestamp, if available.
- Review or archive status, where relevant.

**Application state**
- Information needed to recover safely after a restart.
- Any pending operations that must be resolved consistently.
- Data-integrity information needed to identify incomplete or corrupt records.

The precise serialization format and storage layout remain implementation decisions.

### 8.2 Vote recording

A vote should only be recorded after the visitor confirms the selected answer.

The recording operation should preserve the poll identity and the selected answer. If the device restarts during the results animation, the confirmed vote must not be lost merely because the animation did not finish.

Conversely, an unconfirmed answer must not be counted.

The application should avoid double-counting a single confirmed submission because of a repeated input event, interrupted transition, or recovery after a crash.

### 8.3 Data durability

A permanently deployed device must tolerate ordinary interruptions and restarts.

The storage implementation should account for:

- Power loss during a write.
- A restart while a vote or submission is being recorded.
- A full or nearly full SD card.
- A damaged or incomplete data file.
- A missing SD card.
- A configuration file that cannot be read.
- An application restart during an animation or interaction.

Append-oriented records, periodic checkpoints, redundant configuration copies, or atomic replacement techniques are possible implementation strategies. The chosen strategy should be appropriate to the homebrew runtime and filesystem rather than assumed to work without testing.

The application should never report that a submission succeeded before it has been recorded safely enough for the intended reliability standard.

### 8.4 SD-card compatibility

The software must account for differences between DSi SD storage and the storage arrangements used by original DS and DS Lite homebrew setups.

The storage layer should not assume that every supported device accesses files through the same hardware or runtime interface.

DSi XL is the preferred deployment target, but compatibility claims for other DS hardware should be based on actual testing.

### 8.5 Shutdown and card removal

The owner should have a deliberate way to prepare the application for shutdown or SD-card removal.

The application must not imply that the card can be removed safely while writes are still in progress. It should finish pending writes, flush data where supported, and present a clear indication when the device is ready to shut down or the card may be removed.

Because the card is intended to be removed primarily for backup, this should be an occasional maintenance procedure, not part of routine operation.

## 9. Export and Backup

The computer is an optional external tool for handling copies of the data. It is not the terminal's administrative interface.

### 9.1 Export formats

CSV is a practical primary format for records that owners may want to inspect in a spreadsheet.

Potential exports include:

- Poll definitions and answer labels.
- Aggregate results, including poll identity, answer counts, dates, and percentages where appropriate.
- Suggestions and their relevant metadata.
- Structured comments and response counts.
- Historical records.

A JSON representation may be appropriate for full-fidelity configuration backups or restoring the terminal's complete state.

The final export schema and which records should be included in each export remain to be specified.

### 9.2 Backup expectations

Exported files should be readable and clearly named. A backup should preserve enough information to distinguish different polls and their historical results.

The implementation should avoid treating a CSV export as a complete application backup if it omits configuration, identifiers, or other information needed to restore the terminal.

The owner should be able to export data without an internet connection.

### 9.3 Data lifecycle

The owner must be able to archive old polls and manage accumulated feedback.

The application should make it possible to keep useful history without allowing old records to clutter the active interface indefinitely.

Deletion and archival must remain distinct operations. Before deleting records, the application should make the scope of the action clear.

## 10. Privacy and Security

The terminal is public-facing and unattended. Its security model should be appropriate to that environment.

### 10.1 Data minimization

The application should not ask visitors for names, email addresses, phone numbers, or other personal information by default.

A vote is an aggregate response. A suggestion is a piece of submitted text. Neither needs an identity field to fulfill the product's primary purpose.

The software should not claim that a vote represents a unique person. The terminal cannot reliably prevent someone from voting more than once.

### 10.2 Public privacy

Visitors should not be able to browse other people's suggestions, comments, or administrative records.

After a submission, the public interface should return to a clean state and avoid exposing the previous visitor's entered text to the next person.

The application should not reveal historical results before voting, according to the established public interaction model.

### 10.3 PIN protection

Administrative access must be PIN-protected. A suitable implementation should avoid storing the PIN in plaintext and should use an appropriate salted password-hashing method where the available runtime supports one.

Repeated failed attempts should be rate-limited or otherwise discouraged.

The security design should recognize its limits: a PIN on a homebrew application cannot prevent someone with physical access to the storage card from inspecting or modifying local files, replacing software, or attempting to bypass the interface.

The goal is to prevent casual patrons from entering administration, not to claim protection against a determined physical attacker.

### 10.4 Data retention

The owner should control the retention of suggestions, comments, and poll history through archive and deletion functions.

The first version need not implement elaborate retention policies, but it should provide workable tools for managing stored records and avoid accumulating sensitive information unnecessarily.

## 11. Reliability and Recovery

Because the terminal is expected to remain deployed, reliability is part of the user experience.

A device that occasionally requires a computer to recover its state is not fulfilling the intended appliance model.

### 11.1 Startup

The application should launch directly into the public experience after startup.

It should load the last valid configuration, identify the active poll if one exists, and restore a safe public-ready state.

It must not require the owner to navigate a file browser or manually select the poll each time the device starts.

### 11.2 No active poll

The application must have a defined public state when no poll is active.

Visitors should still be able to use Suggest and Comment if those modes are enabled. The terminal should not present a broken poll screen or appear to have stopped working.

### 11.3 Storage failure

If storage is unavailable or corrupt, the application should fail safely rather than silently discarding data or presenting a false success message.

Where possible, it should preserve recoverable records and provide the administrator with a clear path to inspect the problem.

The public interface should remain controlled and should not expose administrative data while handling an error.

### 11.4 Power interruption

A restart during an animation should not change the meaning of recorded data.

A confirmed vote should remain recorded. An unconfirmed vote should remain uncounted. A suggestion or comment should be either safely recorded or clearly treated as incomplete.

### 11.5 Capacity limits

The application should have defined behavior when storage is almost full.

It should warn the administrator before capacity becomes critical where feasible, and it must not silently overwrite historical records to make room.

If a new submission cannot be saved, the application should not tell the visitor that it was received successfully.

## 12. Technical and Platform Constraints

The application should be designed for the DS hardware rather than treated as a desktop interface that happens to fit on a small screen.

### 12.1 Resolution and layout

Each DS screen has a native resolution of 256 × 192 pixels. The two screens have separate physical display areas and are separated by the hinge.

The interface must be designed around those real dimensions. Desktop previews can help with iteration, but the physical device is the authority on legibility, spacing, touch accuracy, and perceived scale.

### 12.2 Touch interaction

The lower touchscreen is the principal public input surface.

Controls must be large enough to tap comfortably with a stylus, with clear separation between adjacent choices. Important actions should not depend on tiny icons or precise finger gestures.

The application should use a consistent visual response to touch, so visitors receive immediate feedback when an input is registered.

### 12.3 Text entry

Text entry is one of the most constrained interactions on the DS.

The keyboard should prioritize concise submissions, clear correction behavior, and a straightforward submission path. The interface should not demand unnecessary text.

The character limit, keyboard arrangement, correction controls, and behavior when a visitor abandons a draft must be validated on real hardware.

### 12.4 Performance

Animation, transitions, and illustrations must be achievable within the capabilities of the target device.

The interface should prioritize responsiveness over elaborate effects. A simple, well-timed animation is preferable to a complex transition that delays the next interaction.

### 12.5 Browser prototyping

If a browser prototype is used during development, it should represent the DS's dual-screen layout, the physical gap between screens, and the native display proportions.

A 2× nearest-neighbor presentation can help reproduce the intended pixel-art appearance while allowing the prototype to be viewed at a larger size.

The prototype should simulate relevant controls and interaction flows. Hardware-specific behavior that cannot run in the browser should be represented only as a mock interface where needed, not presented as working functionality.

The prototype is a development aid; final behavior must be verified in the intended homebrew environment.

## 13. Out of Scope for the Initial Product

The initial application does not require:

- An internet connection.
- A cloud account or remote database.
- A web-based administrative dashboard.
- Routine computer-based poll management.
- Remote configuration or monitoring.
- A requirement for visitors to install an app or scan a QR code.
- Personal identifiers for ordinary votes, suggestions, or comments.
- A mechanism that guarantees one vote per person.
- Public browsing of other visitors' suggestions.
- A custom console enclosure or hardware modification.
- Elaborate animations that compromise responsiveness.
- Direct imitation of Everybody Votes Channel characters or artwork.

These exclusions preserve the central idea: a standalone, offline, permanently deployed participation appliance.

## 14. Suggested Development Order

The following order is an implementation proposal, not a change to the product's requirements.

**Phase 1 — Core appliance.** Establish reliable startup, the public-ready state, local configuration, active-poll handling, and the distinction between public and administrative modes. The application should already behave like a dedicated terminal rather than a conventional homebrew menu.

**Phase 2 — Complete voting cycle.** Implement poll presentation, two- and four-option layouts, answer selection, confirmation, reliable vote recording, results reveal, and return to public use. Test interruptions and restarts throughout the flow.

**Phase 3 — Suggest and Comment.** Implement the stylus keyboard, short-text submission, structured feedback prompts, submission confirmation, and safe clearing of public-session state. Ensure both modes remain usable when no poll is active.

**Phase 4 — On-device administration.** Implement PIN entry and locking, Poll Manager, Feedback Inbox, Results and History, Appearance and Behavior, Records and Storage, and Terminal Settings. This phase is essential to the product definition, not optional polish.

**Phase 5 — Export, backup, and recovery.** Implement exports, full configuration backup where supported, archival and deletion, shutdown preparation, and recovery from missing or damaged data. Test full-card and interrupted-write scenarios.

**Phase 6 — Visual polish and deployment testing.** Refine illustration, color, touch feedback, animation timing, results presentation, and idle behavior. Test the terminal in a realistic unattended environment, including long periods of operation, repeated visitor sessions, and administrative maintenance.

## 15. Acceptance Criteria

The product should not be considered complete merely because a visitor can answer a poll. It must fulfill the permanent-appliance model.

**Public interaction**
- The application launches directly into a public-ready experience.
- Visitors can understand the available participation modes without a tutorial.
- Vote supports two-option and four-option polls.
- The question appears on the upper screen and the primary input controls appear on the lower touchscreen.
- A visitor must confirm a selected answer before it is recorded.
- Results remain hidden until the visitor has submitted a vote.
- Results show percentages and raw vote counts.
- Suggest supports short free-text submissions.
- Comment supports structured feedback.
- Suggestions and comments are not exposed to other visitors.
- Completed interactions return the device to a clean public-ready state.
- The public experience remains usable without audio.

**Administration**
- Administrative access is protected by a PIN.
- Public visitors cannot reach administrative functions through the ordinary interface.
- The owner can create, configure, preview, activate, deactivate, and archive polls on-device.
- Historical results remain interpretable after a poll is edited or replaced.
- The owner can read, review, archive, and delete suggestions and comments on-device.
- The owner can inspect historical poll results without a computer.
- Supported appearance and behavior settings can be changed on-device.
- PIN management and a documented recovery procedure exist.
- Administration relocks after the configured inactivity period.

**Storage and recovery**
- Polls, votes, suggestions, comments, and settings are stored locally.
- No internet connection is required for ordinary operation or administration.
- Confirmed votes survive an interrupted results animation or restart.
- Unconfirmed votes are not counted.
- A single submission is not duplicated by ordinary recovery behavior.
- Storage-full and storage-failure cases do not produce false success messages.
- The application distinguishes archival from deletion.
- Data can be exported without an internet connection.
- The owner can prepare the application for safe shutdown and SD-card removal.
- The application can recover into a controlled state after an ordinary restart.

**Visual and platform quality**
- The visual identity is distinct from Clipboard and Count.
- The experience is colorful, expressive, and inviting without sacrificing clarity.
- Animation reinforces interaction and does not obstruct reading or input.
- Touch controls are comfortable to use on the actual hardware.
- Text remains legible at native DS resolution.
- The application has been tested on the intended deployment hardware.

## 16. Decisions Still Open

These questions should remain explicit rather than being settled by accident during implementation.

1. **Product name:** The public modes are Vote, Suggest, and Comment. The overall application name is undecided. Vote, Say, Common, and Suggestion Box have been discussed as possible directions, but none is final.
2. **Active-poll policy:** One active poll at a time is the simplest initial model. Confirm whether the product should support anything more complex.
3. **Public idle state:** Determine its layout, animation, and the conditions under which it appears.
4. **Session timeout:** Choose how long an abandoned interaction remains active before the terminal resets to public use.
5. **Results reveal:** Finalize the graph type, animation, reveal duration, and dismissal behavior.
6. **Illustration system:** Define the original visual characters or symbols, animation frames, and how they are used without suggesting false precision.
7. **Comment configuration:** Finalize the supported structured prompt and response types.
8. **Suggestion limit:** Validate the proposed short-text limit and keyboard layout on real hardware.
9. **PIN recovery:** Choose a practical, documented recovery process that does not create an obvious public bypass.
10. **Export schema:** Define the CSV columns, JSON backup structure, filenames, and restore expectations.
11. **Storage implementation:** Select and test the persistence strategy for the target homebrew runtime.
12. **Hardware support:** Establish which DS, DSi, and DS Lite configurations will be officially supported.
13. **Retention defaults:** Decide whether old feedback remains until manually archived or deleted, and whether any automatic retention mechanism is warranted.
14. **Deployment details:** Validate power, stand placement, stylus access, and long-running stability in a real venue.

## 17. Product Definition

The Public Participation Terminal is an offline, on-device-administered Nintendo DS application for inviting visitors to participate in a shared space through voting, suggestions, and structured comments.

Its defining characteristics are the combination of a permanently deployed physical device, a playful public-facing experience, dual-screen interaction, hidden-before-voting results, and comprehensive local administration.

The device must remain useful without a computer or network connection. The owner can manage polls, review feedback, inspect historical results, configure the experience, and maintain local records directly on the console. The SD card provides a practical route for backup and export rather than a substitute for on-device administration.

The product succeeds when a visitor can approach the device and participate in a few seconds, while the venue owner can leave it on the counter for extended periods with confidence that the application will continue working and that its records will remain manageable.

The governing requirement is simple: once installed and configured, the terminal must be fully operable, configurable, and maintainable without a computer or an internet connection.
