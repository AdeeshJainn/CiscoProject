# SPRING INTERN 2026 | STUDENT EDITION
## SPR26_P03: Lecture-Hall Seat Finder
### AI-Assisted Coding Interview Problem

## Problem Statement
Build a Lecture-Hall Seat Finder that recommends a suitable seat or adjacent group of seats from a fixed local room map. A complete demonstration should let a student enter a few preferences, see eligible blocks ranked with understandable reasons, and highlight the recommendation on the map.

Finding two seats together can be surprisingly awkward when some seats are unavailable, a desk has an obstructed view, or a group needs access to a charging socket. The finder should make a transparent recommendation from the supplied map. It is not a booking or reservation system: checking or selecting a recommendation must never change whether a seat is available.

In the supplied room, each row has five numbered seats and the middle seat cannot be used. A student looking for two adjacent seats in the MIDDLE zone, requiring at least one socket and preferring an aisle, should receive B1 + B2 with score 4. B4 + B5 has the same score, so the lower starting column keeps B1 + B2 first. A request for five adjacent seats is valid but has no match because every row is interrupted by an unavailable or obstructed middle seat.

Use one attractive primary screen or clear visual report with a compact preference form, a labelled seat map and legend, a Recommend action, a ranked result panel with reasons, a valid no-match state, validation feedback, and sample/reset controls. A browser, desktop or mobile app, spreadsheet or notebook, or CLI that produces a clear visual or tabular report is acceptable. Use familiar local technologies; no backend, account, campus system, live occupancy feed, booking, or reservation workflow is required. A sensible workflow is to load and validate the map, enumerate eligible consecutive blocks, score and sort them, then connect the ranked result to the map and test normal, boundary, no-match, and invalid cases.

## Contracts
Use the deterministic room, seats, and preferences in the Included Data section of this document. Seat IDs and (row, column) coordinates must each be unique. Rows and columns are positive whole numbers, every row has one of the supplied FRONT, MIDDLE, or BACK zones, and available, obstructed, aisle, and socket are Boolean values.

groupSize must be a whole number from 1 through the room's columns, inclusive. preferredZone is exactly ANY, FRONT, MIDDLE, or BACK; requiresSocket and prefersAisle are Boolean values. Malformed fields, an unknown zone, duplicate IDs, or duplicate coordinates are invalid input.

A candidate block contains exactly groupSize seats in one row with consecutive column numbers. Every seat in the block must exist, be available, and not be obstructed. When requiresSocket is true, at least one seat in the block must have a socket.

Start every eligible block at score 0. Add 3 when preferredZone is not ANY and the block's row has that zone. Add 1 when prefersAisle is true and at least one seat in the block is an aisle seat. Do not add or subtract any other points.

Sort eligible blocks by score descending, then row number ascending, then starting column ascending. Show the selected seat IDs, score, and which of the two scoring reasons applied. Recommend the first block and show the remaining blocks as ranked alternatives.

A valid request with no eligible block reports NO_SUITABLE_BLOCK and an empty ranked list; it is not invalid input. Invalid input clears any earlier recommendation and shows the exact stable error code in the supplied invalid fixture: INVALID_GROUP_SIZE, INVALID_ZONE, DUPLICATE_SEAT_ID, or DUPLICATE_COORDINATE.

Recommending, highlighting, or selecting a result is read-only. It must not mark seats unavailable, create a hold, or imply that a booking has been made.

## Acceptance Criteria
Load all 15 supplied seats in one action, display their row/column positions and availability, obstruction, aisle, and socket states with a legend, and let the user change the supplied preferences.

For preference P01, recommend B1 + B2 with score 4, show both applied reasons, and rank B4 + B5 second with the same score.

For boundary preference P02, evaluate single-seat blocks with all scores at 0 and recommend A1 using the row and starting-column tie-breaks.

For valid no-match preference P03, show NO_SUITABLE_BLOCK, an empty ranked list, and no highlighted recommendation.

Demonstrate invalid preference IP01 and invalid seat set IS01: each clears stale results and shows INVALID_GROUP_SIZE or DUPLICATE_SEAT_ID respectively.

Confirm that repeated recommendations and result selection never mutate seat availability, and that Reset restores P01 and the original map.

Use AI coding assistants. Before implementation, create a short plan with 3–5 ordered steps and useful checkpoints. Be prepared to present that plan, explain any changes you made to it, share relevant prompts, summarize your design, and show test evidence such as tests, screenshots, or output samples.

## How You'll Be Evaluated
Planning and Solution Presentation: Present your 3–5-step implementation plan, explain how the work followed or changed that plan, and demonstrate the working solution with clear explanations

AI Prompting Strategy: Show the prompts you used to translate this problem statement into technical specifications for AI assistants

Design Constraints and Technology Choices: Explain the constraints you provided to AI regarding design patterns, technology stack, and architectural decisions

AI-Influenced Decision Making: Discuss trade-offs, assumptions, and how AI recommendations influenced your choices for components, data structures, and implementation approaches

Testing and Validation: Demonstrate how you tested the application covering both typical usage scenarios and edge cases

Live Modification Capability: Be prepared to implement one small modification, and possibly a second if time permits, using AI assistance; keep your development environment ready for focused changes and verification

## Included Data
This section contains all data required for the problem. Use it directly; no separate data file is required. Boolean values are shown literally as true or false.

### Room
| Field | Exact value |
| --- | --- |
| id | LH101 |
| name | Lecture Hall 101 |
| columns | 5 |

### Row zones
| Row | Label | Zone |
| --- | --- | --- |
| 1 | A | FRONT |
| 2 | B | MIDDLE |
| 3 | C | BACK |

### Seat Map
| Row / Zone | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| AFRONT | A1<br>available<br>aisle \| socket | A2<br>available | A3<br>unavailable | A4<br>available<br>socket | A5<br>available<br>aisle |
| BMIDDLE | B1<br>available<br>aisle | B2<br>available<br>socket | B3<br>unavailable | B4<br>available<br>socket | B5<br>available<br>aisle \| socket |
| CBACK | C1<br>available<br>aisle | C2<br>available<br>socket | C3<br>obstructed | C4<br>available<br>socket | C5<br>available<br>aisle |

Legend: Every cell names its state in text. Blue tint = available; gray = unavailable; gold = obstructed. Aisle and socket features are written below the seat ID.

### Complete Seat Records
| ID | Row | Column | Available | Obstructed | Aisle | Socket |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | 1 | 1 | true | false | true | true |
| A2 | 1 | 2 | true | false | false | false |
| A3 | 1 | 3 | false | false | false | false |
| A4 | 1 | 4 | true | false | false | true |
| A5 | 1 | 5 | true | false | true | false |
| B1 | 2 | 1 | true | false | true | false |
| B2 | 2 | 2 | true | false | false | true |
| B3 | 2 | 3 | false | false | false | false |
| B4 | 2 | 4 | true | false | false | true |
| B5 | 2 | 5 | true | false | true | true |
| C1 | 3 | 1 | true | false | true | false |
| C2 | 3 | 2 | true | false | false | true |
| C3 | 3 | 3 | true | true | false | false |
| C4 | 3 | 4 | true | false | false | true |
| C5 | 3 | 5 | true | false | true | false |

### Preference Scenarios
| ID | groupSize | preferredZone | requiresSocket | prefersAisle |
| --- | --- | --- | --- | --- |
| P01 | 2 | MIDDLE | true | true |
| P02 | 1 | ANY | false | false |
| P03 | 5 | ANY | false | false |

### Invalid Examples

#### Invalid preferences
| ID | groupSize | preferredZone | requiresSocket | prefersAisle | Expected |
| --- | --- | --- | --- | --- | --- |
| IP01 | 0 | MIDDLE | true | true | invalidINVALID_GROUP_SIZE |
| IP02 | 1 | NEAR_DOOR | false | false | invalidINVALID_ZONE |

#### Invalid seat-set records
| Set ID | Seat ID | Coordinates | Available | Obstructed | Aisle | Socket |
| --- | --- | --- | --- | --- | --- | --- |
| IS01 | X1 | 1, 1 | true | false | true | false |
| IS01 | X1 | 1, 2 | true | false | false | true |
| IS02 | Y1 | 1, 1 | true | false | true | false |
| IS02 | Y2 | 1, 1 | true | false | false | true |

#### Invalid seat-set expected outcomes
| Set | Status | Error code |
| --- | --- | --- |
| IS01 | invalid | DUPLICATE_SEAT_ID |
| IS02 | invalid | DUPLICATE_COORDINATE |
