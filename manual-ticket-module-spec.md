# Manual Ticket Capture Module – Technical Spec for Claude Code

## 1) Purpose
Implement a new **Manual Ticket Capture** module in the **web system** so operators can register a complete ticket manually when the POS / scale workflow is unavailable.

The manual ticket must behave like a **normal sale created by the POS**, meaning it must integrate with the same transactional flow and remain compatible with existing features such as:
- reweigh
- void
- reports
- PDFs / ticket printing
- customer statements
- payment summaries
- business account rules

The only extra traceability required is to **mark the sale as manual**.

---

## 2) Important implementation rule
Before changing anything, Claude Code must:

1. Read the **entire existing project structure**.
2. Inspect both **backend** and **frontend** code.
3. Identify:
   - folder structure
   - module conventions
   - menu registration pattern
   - permission / role pattern
   - route registration pattern
   - service / repository / controller structure
   - how sales are currently created
   - how tickets, payments, driver info, and axle/session data are inserted
4. Confirm how the system currently handles:
   - superadmin permissions
   - administrator permissions
   - menu visibility
   - transaction save flow
   - ticket numbering / next ticket logic
5. Only after that, propose the final technical implementation and then apply it.

**Do not invent a parallel architecture. Reuse the existing project patterns.**

---

## 3) Business context
The client needs a contingency workflow.

When the normal system is down or unavailable, they still capture a ticket manually on paper with:
- axle 1 weight
- axle 2 weight
- axle 3 weight (if applicable under current business rules)
- total weight
- driver information
- vehicle / trailer / plates data
- customer
- payment method
- whether the customer has business credit or not
- all normal sale data required by the system

Later, they must enter that manual ticket into the **web application**, and that record must be saved as if it had been created by the normal POS flow.

---

## 4) Main functional objective
Create a web module that allows authorized users to manually create a sale/ticket with the same business behavior as POS.

### Critical rule
This manual capture must not be a “fake report-only record”.
It must create a **real sale transaction** compatible with the rest of the ecosystem.

---

## 5) Data model recommendation
### Primary recommendation
If the only extra traceability needed is to identify that a sale was created manually, the safest and simplest place to mark it is:

### `sales.capture_source`
Suggested values:
- `POS`
- `WEB_MANUAL`

Suggested implementation:
- `VARCHAR(20)` or similar
- `NOT NULL`
- default value: `POS`

### Why this is preferred
The sale is the central transaction. A ticket is only one representation/folio of that transaction.
If the goal is only to mark manual origin, placing the flag on `sales` is cleaner than marking only `tickets`.

### Only add more fields/tables if truly needed
Do **not** create unnecessary extra tables unless the existing architecture clearly requires it.

### Claude must confirm before applying
Claude Code must first inspect the schema and current usage of:
- `sales`
- `tickets`
- `payments`
- `sale_driver_info`
- `scale_session_axles`
- any related helper tables / sequence tables / stored procedures

Then confirm whether:
- only `sales.capture_source` is enough, or
- another existing field / pattern already supports this.

---

## 6) Database scope
Claude must prepare the necessary SQL script(s).

### Expected minimum DB change
1. Alter `sales` to add manual source marker, unless the schema already has an equivalent field.
2. Validate that no extra schema changes are needed for normal insertion flow.
3. Confirm whether `scale_session_axles` already supports manual insert without modifications.
4. Confirm whether ticket numbering already has a reusable sequence mechanism.

### SQL deliverables expected
Claude must generate:
- migration SQL for schema change(s)
- rollback SQL when reasonable
- any seed/permission/menu SQL if this project uses DB-driven menu or permissions

---

## 7) Manual ticket numbering
The web module must generate the next ticket number using the system’s existing logic.

### Required behavior
The system must:
- inspect how ticket numbers are currently generated
- reuse the same pattern
- obtain the next valid ticket number
- avoid breaking the current sequence

### Important
Do **not** implement an unsafe `MAX(ticket_number)+1` if the current project already has a safer sequence/service/procedure.

Claude must inspect current code and DB first, then reuse the existing approach.

---

## 8) Transactional behavior required
Manual ticket creation must insert data correctly into the same normal flow used by POS.

Claude must inspect how POS currently saves a sale and replicate the same business behavior from the web module.

### Expected records involved
At minimum, verify and insert correctly where applicable:
- `sales`
- `tickets`
- `payments`
- `sale_driver_info`
- `scale_session_axles`
- `sale_lines` if the current model requires it for WEIGH / REWEIGH products
- any credit/balance table updates required by business account logic

### Important
The module must produce a valid `sale_uid` and maintain compatibility with the existing relationships.

---

## 9) Functional requirements
### 9.1 Create manual sale
Authorized user can open a manual capture screen and register:
- customer
- service/product as required by existing logic
- driver information
- vehicle / trailer / plate information
- axle 1
- axle 2
- axle 3 (if applicable)
- total
- payment method
- credit/business account selection if customer qualifies
- any other fields required by the current sale model

### 9.2 Manual sale behaves like normal POS sale
The record must be a real sale and later support:
- reweigh
- void
- appearance in normal reports
- PDFs / ticket rendering
- customer statement inclusion
- payment summary inclusion

### 9.3 Manual origin flag
The sale must be identifiable as manual using the chosen field (recommended: `sales.capture_source = 'WEB_MANUAL'`).

---

## 10) Business rules that must be preserved
Claude must inspect the existing sale/payment logic and preserve current rules.

### Must preserve
1. **Business account / credit validations**
   - same validation rules as POS
   - same restrictions if customer has no credit
   - same behavior for eligible / non-eligible customers

2. **Payment method rules**
   - same allowed methods as POS
   - same mixed payment behavior if POS allows it
   - same restrictions for business account combinations if applicable

3. **Credit updates**
   - if a business account payment is used, the same update logic must run
   - do not create a simplified flow that skips balance updates

4. **Sale structure**
   - if POS always creates a product/service line (e.g. WEIGH / REWEIGH), manual flow must do the same

5. **Session axles**
   - manual entry must insert into `scale_session_axles` using the same structure/order expected by the system
   - this must not break existing queries or downstream flows

6. **Void / reweigh compatibility**
   - manual sales must remain eligible for the same lifecycle behavior as standard sales where applicable

---

## 11) Permissions and access
Claude must inspect how permissions are currently implemented in the project.

### Required access
This new module must be enabled for:
- **Superadmin**
- **Administrator**

### Claude must verify
- how roles are stored
- how modules are protected
- how menu items are shown/hidden
- whether permission seeds or mappings are required

### Deliverables expected
If the project uses permission seeds/config, Claude must create what is needed for:
- permission key / action key
- menu registration
- route protection
- frontend visibility

---

## 12) Menu integration
Claude must inspect how the current web application registers modules in the menu.

### Required behavior
Add the new module to the appropriate menu section using the existing project pattern.

### Notes
- do not hardcode an inconsistent menu item
- reuse the same icons, labels, route style, translation style, and permission checks already used by the project
- only Superadmin and Administrator should see/access it

---

## 13) Frontend requirements
Claude must inspect the frontend structure first and implement the new module following the project conventions.

### Expected screen behavior
Create a manual ticket capture page/form that:
- is clear and operator-friendly
- captures all required normal sale data
- validates required fields
- supports business account validation
- supports normal payment logic
- shows a final review/confirmation if the project style supports it

### UX rule
This is a contingency screen, so it should be practical and explicit.

### Important
Do not redesign the entire app. Follow the existing UI patterns used by current modules.

---

## 14) Backend requirements
Claude must inspect the backend structure and create the module following the current conventions.

### Expected backend work
- route(s)
- controller/service/repository/model as needed by existing architecture
- transactional save logic
- validation layer
- permission enforcement
- sequence/next ticket integration
- business account validation reuse
- proper rollback on error
- responses aligned with existing API standards

### Important
Do not duplicate logic that already exists.
If there is already a service that creates normal sales, reuse it or extract shared logic.

---

## 15) Compatibility requirements
After implementation, the manual sale must behave correctly in:
- reweigh flow
- void flow
- existing reports
- PDF/ticket generation
- customer statement logic
- payment summary logic

Claude must inspect these dependencies and apply only the minimum adjustments required so the manual sale is fully compatible.

---

## 16) Edge cases to consider
Claude must explicitly evaluate these cases:

1. customer with valid business credit
2. customer without available business credit
3. cash payment
4. card payment
5. mixed payment if supported
6. manual sale later used in reweigh
7. manual sale later voided
8. missing optional axle / third axle scenarios if current business logic supports variable axle counts
9. ticket number sequence collision risk
10. transactional rollback if one insert fails after `sales` is created

---

## 17) Non-goals
To keep scope controlled, do **not** add unrelated features.

### Not required unless existing architecture forces it
- deep audit/history tables for manual edits
- separate manual-ticket subsystem outside the normal sales flow
- alternate reporting engine
- duplicate POS architecture inside web if reusable logic already exists

---

## 18) Acceptance criteria
This module is accepted only if all of the following are true:

1. Authorized users (Superadmin/Admin) can access the new menu option.
2. User can create a manual ticket from the web module.
3. Ticket number is generated using the project’s real sequence logic.
4. Sale is saved as a real normal transaction.
5. Sale is marked as manual using the agreed field.
6. Axle/session data is saved in compatible format.
7. Payment logic matches existing POS business rules.
8. Business account logic matches existing POS business rules.
9. The saved record appears correctly in downstream flows/reports.
10. Reweigh and void continue working for that sale.
11. No existing normal POS flow is broken.

---

## 19) Required implementation approach for Claude Code
Claude must work in this order:

### Phase 1 – Audit
Inspect the project and document:
- backend folder structure
- frontend folder structure
- permissions structure
- menu structure
- current sales creation flow
- ticket number generation flow
- related tables and relationships
- candidate files/modules to modify

### Phase 2 – Technical proposal
Before coding, provide:
- chosen DB change(s)
- explanation of why the manual marker lives there
- list of backend files to create/modify
- list of frontend files to create/modify
- permission/menu changes needed
- risk notes

### Phase 3 – Implementation
Then implement using existing project conventions.

### Phase 4 – Validation
Provide:
- SQL scripts
- files changed
- test scenarios executed
- impact summary

---

## 20) Expected deliverables
Claude Code must leave the work complete with:

1. SQL migration script(s)
2. backend implementation
3. frontend implementation
4. permission/menu integration
5. any seeds/config required
6. summary of modified files
7. validation checklist

---

## 21) Additional guidance
### Strong recommendation
Prioritize reuse over reinvention.
If the project already has a robust transaction creation flow, manual web capture should call/reuse the same core logic wherever possible.

### Final decision guidance
If after code audit Claude determines that placing the manual marker on `sales` is correct, use that approach.
Only choose a different place if the actual project architecture clearly proves a better fit.

