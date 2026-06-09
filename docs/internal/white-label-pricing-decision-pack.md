# White Label Pricing Decision Pack
**Internal Use Only — Do Not Publish**
**Status: v1 Draft — Pending Validation Against Deal Archetypes**

---

## Purpose & How to Use This Document

This document exists to establish a defensible internal pricing model for MPM white label partnerships **before** any pricing ranges are published publicly.

The funnel (WhiteLabelSolutions.tsx) currently shows qualitative tier descriptions with no dollar figures. That is intentional. This document is the prerequisite for adding numbers to Stage 13.

**The process:**
1. Read through each deal archetype worksheet and fill in what you know from real conversations.
2. Validate the cost model assumptions against your actual delivery experience.
3. Set margin floors and discount guardrails.
4. Produce the output ranges (Section 8).
5. Get leadership sign-off on floors and tiers.
6. Only then update Stage 13 with real numbers.

---

## Section 1: Deal Archetype Worksheets

These are the real people and organizations MPM is already talking to or has identified as ideal customers. Each worksheet asks the same four questions. Fill in what you know. Leave blanks where you need more discovery.

---

### Archetype A: Independent Coach or Solo Practitioner
*Reference deal: Independent coach / dietitian / nutritionist*

**Who they are:**
An individual professional — registered dietitian, certified nutritionist, personal trainer, or health coach — serving their own client base. May or may not have a team. Usually under 200 active clients at launch. Building a branded nutrition tool to deepen client relationships and differentiate from competitors.

**What they get:**
- Branded web environment (logo, colors, name)
- Standard coaching persona configuration
- All 8 meal creation modes available to members
- Basic clinical protocols (anti-inflammatory, standard dietary restrictions)
- No App Store deployment (web-first)
- Standard support SLA
- 12-month initial term

**What does it cost MPM to deliver?**
- Setup: 2–3 weeks engineering (brand config, environment build, staging delivery)
- Clinical config: minimal (standard protocols, no physician-assigned overrides)
- Persona config: 1–2 weeks (name, voice, description style)
- Launch support: 1 week
- Recurring: low AI token volume, standard infra allocation, shared support pool
- *Estimated MPM cost: [TO BE FILLED — internal engineering + infra estimate]*

**What is the minimum viable deal?**
- Must cover setup cost + 12 months of platform cost + margin
- Minimum term: 12 months
- *Minimum deal size: [TO BE SET AFTER COST MODEL COMPLETE]*

**Known risks / complications:**
- Highest churn risk if their client base doesn't grow
- May underestimate what "launching an app" requires on their end
- Price sensitivity is real — they are solo operators

**Discovery questions still needed:**
- What is their current client billing rate? (Signals willingness to pay)
- Do they have a team who will handle member onboarding/support?
- What is their growth trajectory?

---

### Archetype B: Amy-Type Healthcare Practitioner / Physician
*Reference deal: Amy*

**Who they are:**
A licensed medical professional — physician, functional medicine practitioner, clinical dietitian — with an established practice. Likely has existing patients/clients who would benefit from a nutrition platform. May have clinical staff. Interested in clinical-mode capabilities (GLP-1, anti-inflammatory, oncology support) because their patient population has real medical needs.

**What they get:**
- Branded web + mobile environment
- Clinical-mode protocols: GLP-1/diabetes-appropriate, anti-inflammatory, physician-assigned overrides
- Medical safety guardrails (always enforced)
- HIPAA-aligned data handling (platform-level)
- Coaching/physician persona configuration
- Priority support SLA
- 12-month initial term

**What does it cost MPM to deliver?**
- Setup: 4–6 weeks (clinical config is more complex, physician-assigned override testing)
- Clinical config: significant (protocol scope validation, ingredient blocks, override logic)
- Persona config: medium (physician voice, clinical instruction style)
- Compliance review: included at platform level; BAA documentation required
- Recurring: moderate AI token volume, higher per-user clinical compute
- *Estimated MPM cost: [TO BE FILLED]*

**What is the minimum viable deal?**
- Clinical scope adds real delivery cost — minimum must reflect this
- BAA handling is a soft-cost line item
- *Minimum deal size: [TO BE SET]*

**Known risks / complications:**
- Licensing board requirements are the partner's responsibility — document clearly
- Physician practices often have slow internal approval processes
- May need white-glove onboarding for their staff
- If they are a solo practitioner, they're closer to Archetype A but with higher clinical overhead

**Discovery questions still needed:**
- How many patients/clients would they onboard at launch?
- Do they have a practice manager who would own the platform operationally?
- What specific clinical protocols are they enabling?
- Do they need App Store deployment for their patient population?

---

### Archetype C: Cindy-Type Design / Brand-First White Label
*Reference deal: Cindy*

**Who they are:**
A brand or agency-adjacent partner who cares deeply about the visual presentation of the product. The nutrition/clinical layer matters less than the aesthetic and UX alignment with their brand. May be in fitness, lifestyle, beauty-wellness, or a consumer brand adding nutrition as a product extension.

**What they get:**
- Deeply customized branded environment (full color palette, typography, icon style, content voice)
- Custom coaching persona (full naming, description voice, instruction style, dietary philosophy)
- Standard or limited clinical protocols
- Web + possible mobile deployment
- Standard support SLA
- 12-month initial term

**What does it cost MPM to deliver?**
- Setup: 4–5 weeks (persona config is the dominant cost — custom branding is more design-intensive)
- Clinical config: low to moderate
- Persona config: high (this archetype will have opinions and revisions)
- Creative review cycles: plan for 2+ revision rounds on persona voice
- *Estimated MPM cost: [TO BE FILLED]*

**What is the minimum viable deal?**
- Persona depth adds real labor — pricing should reflect revision scope
- Define revision rounds in contract to cap scope creep
- *Minimum deal size: [TO BE SET]*

**Known risks / complications:**
- Highest revision risk of any archetype
- May have unrealistic expectations about design flexibility (platform has guardrails)
- If their audience is consumer-facing (not medical), conversion and retention expectations will be different
- Needs clear documentation of what can and cannot be customized

**Discovery questions still needed:**
- What does their audience look like? (Consumer vs. professional)
- Do they have existing brand guidelines?
- What is their timeline — are they launching a new product or augmenting existing?
- Have they had a software licensing relationship before?

---

### Archetype D: Multi-Coach Fitness Company
*Reference deal: Fitness brand / training studio / multi-location gym*

**Who they are:**
A fitness brand with multiple coaches on the platform, possibly multiple locations. Has an existing recurring membership model and wants to add a nutrition layer. Members are active gym-goers or athletes — dietary preferences lean toward performance, not clinical.

**What they get:**
- Branded environment for all coaches + members
- Multi-coach / multi-studio admin structure
- Standard + performance-oriented dietary personalization
- Coaching persona per brand (or per coach, depending on scope)
- Custom domain
- Web + possible App Store deployment
- Priority support SLA
- 12-month initial term

**What does it cost MPM to deliver?**
- Setup: 4–6 weeks (multi-coach config, studio hierarchy, role management)
- Clinical config: low (performance protocols, not medical)
- Persona config: medium to high (multiple coaches may each want distinct voices)
- Multi-location rollout support: added labor
- *Estimated MPM cost: [TO BE FILLED]*

**What is the minimum viable deal?**
- Multi-coach scope increases setup complexity meaningfully
- User volume is typically higher than solo practice — good for recurring
- *Minimum deal size: [TO BE SET]*

**Known risks / complications:**
- Coach turnover means ongoing persona management
- Members expect gym-culture language, not clinical language — persona alignment is critical
- May want custom integrations with existing gym management software (out of scope unless specified)

**Discovery questions still needed:**
- How many coaches? How many locations?
- What is current member count and expected growth?
- Do they want per-coach personas or a unified brand voice?
- What is their technology stack? (Mindbody, Glofox, etc. — integration considerations)

---

### Archetype E: Divvy Health-Type Healthcare Platform / Partnership
*Reference deal: Divvy Health*

**Who they are:**
An existing health technology platform, employer health program, or population health organization that wants to integrate MPM's nutrition capabilities as a component of their broader offering. Not necessarily building a standalone nutrition product — may be embedding or licensing nutrition capabilities within a larger platform.

**What they get:**
- Depends heavily on integration scope
- May be white label (their brand) or co-branded
- Full clinical mode likely required
- Custom integration with their existing data systems (possible)
- Enterprise support SLA
- Custom implementation scope
- Term and pricing negotiated

**What does it cost MPM to deliver?**
- Setup: highly variable — custom integration could be 8–16+ weeks
- Clinical config: full suite
- API / integration work: custom — this is the biggest cost variable
- Legal / BAA / data-sharing agreements: significant administrative overhead
- Recurring: high volume, enterprise compute allocation
- *Estimated MPM cost: [TO BE FILLED — needs custom scoping]*

**What is the minimum viable deal?**
- Custom integrations require a separate statement of work
- Partnership structure (revenue share vs. licensing fee) may differ from standard model
- *Minimum deal size: [TO BE SET — likely enterprise floor]*

**Known risks / complications:**
- Longest sales cycle of any archetype
- Procurement / legal approval delays are common
- May want exclusivity in a market segment — policy needed
- Partnership vs. licensing framing affects commercial structure
- Revenue model may not be straightforward platform fee

**Discovery questions still needed:**
- Are they licensing or integrating?
- What is their current data infrastructure?
- Who is the economic buyer vs. the technical decision-maker?
- What is their member/patient population size and clinical profile?
- Do they have procurement and legal timelines we need to plan around?

---

### Archetype F: Corporate Wellness Program
*Reference deal: Employer wellness / corporate health benefit*

**Who they are:**
A company — HR team, benefits manager, or wellness vendor — adding nutrition to their employee benefits stack. Usually not building a product for resale; building for internal employee use. May have a vendor relationship manager, not a technical team.

**What they get:**
- Branded environment (company name/logo)
- Limited clinical protocols (standard + possibly anti-inflammatory)
- No App Store deployment typically (web HR tool)
- Admin dashboard for HR team
- Standard or priority support SLA
- 12-month initial term, possibly calendar-year aligned

**What does it cost MPM to deliver?**
- Setup: 3–4 weeks (simpler persona, limited clinical scope)
- Clinical config: low to moderate
- HR-side admin training: low
- Recurring: volume depends on company headcount
- *Estimated MPM cost: [TO BE FILLED]*

**What is the minimum viable deal?**
- Employee headcount drives user volume — pricing must account for activation rate (not all employees will engage)
- Benefits budget cycles are annual — timing matters for close
- *Minimum deal size: [TO BE SET]*

**Known risks / complications:**
- Engagement rates in corporate wellness are notoriously low (20–40%)
- Decision-maker is HR, not the end user — disconnect in expectations
- Budget comes from benefits pool, which has competing priorities
- If headcount drops (layoffs), contract terms need clarity

**Discovery questions still needed:**
- Total employee headcount?
- What is their expected activation/engagement target?
- Are they looking for this to be benefit-eligible or reimbursable?
- What compliance requirements does their benefits stack require?

---

### Archetype G: Insurance / Healthcare Enterprise
*Reference deal: Insurance-related / large healthcare organization*

**Who they are:**
A health insurance plan, employer health organization, or large hospital system. Managing thousands to tens of thousands of members with real clinical needs. Nutrition is a clinical intervention, not just a feature. Compliance, data governance, and audit trails matter at this level.

**What they get:**
- Full clinical mode: anti-inflammatory, oncology support, GLP-1/diabetes, physician-assigned overrides
- Enterprise-scale infrastructure allocation
- HIPAA-aligned data handling + BAA
- App Store deployment (iOS + Android under their brand)
- Deep coaching/clinical persona
- Custom integrations (EMR, claims, population health platforms)
- SLA with response time guarantees
- Dedicated implementation support
- Custom term and pricing

**What does it cost MPM to deliver?**
- Setup: 12–20+ weeks (full clinical config, App Store deployment, custom integrations, compliance review)
- Clinical config: full suite, physician validation required
- Integration work: custom statement of work
- Legal: BAA, data processing agreement, compliance attestation
- Recurring: highest compute tier, dedicated support resources
- *Estimated MPM cost: [TO BE FILLED — enterprise custom]*

**What is the minimum viable deal?**
- Custom integration alone may justify a minimum SOW fee
- Platform fee must reflect enterprise compute + support commitment
- *Minimum deal size: [TO BE SET — enterprise floor, likely $350k+ setup]*

**Known risks / complications:**
- Longest sales cycle (12–18 months common in enterprise healthcare)
- Multiple stakeholders: clinical, IT, legal, procurement, compliance
- Regulatory changes (CMS, state-level) can shift requirements mid-implementation
- Integration complexity creates ongoing maintenance obligations
- Exclusivity requests are common — need a clear policy

**Discovery questions still needed:**
- What is their covered population size and clinical profile?
- What EMR/EHR systems do they use?
- What is their compliance posture (SOC 2, HIPAA, HITECH)?
- Who is the sponsor executive?
- What is their procurement timeline?

---

## Section 2: Packaging Definition

What is actually included at each deployment tier. This is the source of truth for what is and isn't in scope before any pricing conversation.

| Capability | Independent Coach | Growing Org | Regional / National | Enterprise |
|---|---|---|---|---|
| Branded web environment | ✓ | ✓ | ✓ | ✓ |
| Logo, colors, name | ✓ | ✓ | ✓ | ✓ |
| Standard dietary personalization | ✓ | ✓ | ✓ | ✓ |
| All 8 meal creation modes | ✓ | ✓ | ✓ | ✓ |
| Basic clinical protocols | ✓ | ✓ | ✓ | ✓ |
| Standard coaching persona config | ✓ | ✓ | ✓ | ✓ |
| Custom coaching persona (deep) | — | ✓ | ✓ | ✓ |
| Custom domain | — | ✓ | ✓ | ✓ |
| Anti-inflammatory / GLP-1 protocols | — | ✓ | ✓ | ✓ |
| Multi-coach / multi-location admin | — | ✓ | ✓ | ✓ |
| iOS + Android App Store deployment | — | Optional | ✓ | ✓ |
| Oncology support protocol | — | — | ✓ | ✓ |
| Physician-assigned overrides | — | — | ✓ | ✓ |
| Custom integrations (EMR, etc.) | — | — | Optional | ✓ |
| BAA / HIPAA documentation | — | — | ✓ | ✓ |
| Standard support SLA | ✓ | ✓ | — | — |
| Priority support SLA | — | ✓ | ✓ | — |
| Enterprise / dedicated support | — | — | — | ✓ |
| Custom implementation SOW | — | — | Optional | ✓ |

*Anything not in the table defaults to out-of-scope and subject to change-order pricing.*

---

## Section 3: Cost Model

**TO BE COMPLETED.** Fill in actual estimates based on real delivery experience.

### One-Time Setup Costs (MPM Internal)

| Work Item | Independent Coach | Growing Org | Regional / National | Enterprise |
|---|---|---|---|---|
| Environment build + brand config | [hrs] | [hrs] | [hrs] | [hrs] |
| Clinical protocol config + testing | [hrs] | [hrs] | [hrs] | [hrs] |
| Coaching persona config | [hrs] | [hrs] | [hrs] | [hrs] |
| App Store deployment | n/a | Optional | [hrs] | [hrs] |
| Custom integration work | n/a | n/a | [hrs / SOW] | [hrs / SOW] |
| QA + staging delivery | [hrs] | [hrs] | [hrs] | [hrs] |
| Legal / BAA / documentation | n/a | n/a | [hrs] | [hrs] |
| Launch support | [hrs] | [hrs] | [hrs] | [hrs] |
| **Total estimated setup hours** | [sum] | [sum] | [sum] | [sum] |
| **At blended rate of $[X]/hr** | $[calc] | $[calc] | $[calc] | $[calc] |

### Monthly Recurring Costs (MPM Internal)

| Cost Item | Independent Coach | Growing Org | Regional / National | Enterprise |
|---|---|---|---|---|
| AI token cost (per active user/mo) | $[X] | $[X] | $[X] | $[X] |
| Infrastructure allocation | $[X] | $[X] | $[X] | $[X] |
| Storage | $[X] | $[X] | $[X] | $[X] |
| Support allocation | $[X] | $[X] | $[X] | $[X] |
| App Store maintenance (annual) | n/a | $[X] | $[X] | $[X] |
| **Total COGS at [N] users/mo** | $[calc] | $[calc] | $[calc] | $[calc] |

*Fill these in before setting any pricing floors. The monthly platform fee must cover COGS + margin.*

---

## Section 4: Pricing Drivers Matrix

Each factor below affects the price. Assign a weight or multiplier to each level once the cost model is complete.

| Factor | Level | Impact | Notes |
|---|---|---|---|
| **Branding depth** | Standard | Base | Logo + colors only |
| | Custom | +$$ | Full persona, voice, type, icon style |
| **Mobile deployment** | Web only | Base | Responsive web |
| | iOS + Android | +$$$ | App Store review, certificates, annual maintenance |
| **User volume** | <100 active | Base | Starter allocation |
| | 100–500 | +$ | Standard scale |
| | 500–2,000 | +$$ | Mid-market scale |
| | 2,000–10,000 | +$$$ | Regional scale |
| | 10,000+ | Custom | Enterprise compute allocation |
| **Clinical scope** | Standard dietary | Base | Restrictions, preferences, goals |
| | Clinical (GLP-1, anti-inflammatory) | +$$ | Protocol config + testing |
| | Enterprise clinical (oncology, physician overrides) | +$$$$ | Full clinical suite |
| **Integrations** | None | Base | — |
| | Basic (webhooks, SSO) | +$ | Standard integrations |
| | Custom (EMR, claims, population health) | +$$$$$ | Statement of work required |
| **Compliance** | Standard | Base | Data handling, ToS |
| | Healthcare (BAA, HIPAA docs) | +$$ | BAA + documentation package |
| | Enterprise compliance (SOC 2, audit) | Custom | Platform-level + partner-level |
| **Support** | Standard | Base | Shared support pool, standard SLA |
| | Priority | +$ | Faster response, named contact |
| | Enterprise / dedicated | +$$$ | Dedicated support channel, SLA guarantees |

---

## Section 5: Commercial Policy

*To be finalized once cost model and margin floors are set.*

### Setup Fee
- One-time, due before implementation begins
- Non-refundable after environment build starts
- Covers: brand config, persona build, clinical config, QA, staging delivery, launch support
- App Store deployment billed separately (or bundled at higher tiers)
- Custom integration work is a separate statement of work

### Monthly Platform Fee
- Begins after environment delivery (not after contract signing)
- Invoiced monthly or quarterly (quarterly preferred for larger deals)
- Includes: AI infrastructure, security updates, platform maintenance, new feature releases
- Does not include: integration maintenance, change orders, additional persona builds

### User Volume Bands
- Base tier: up to [N] active users/month included
- Overage: $[X] per active user above base tier
- Activation rate assumption: define "active user" clearly in contract (meal generated or logged in 30 days — TBD)

### Minimum Term
- 12-month initial term (already documented in funnel)
- 90-day written notice required for exit after initial term
- Auto-renews annually unless notice given

### Change Order Rules
- Any capability not in the original packaging definition is a change order
- Change orders require written agreement before work begins
- Change order rate: $[X]/hr or flat fee depending on scope

---

## Section 6: Guardrails

*To be set by leadership before any pricing is published or quoted.*

| Guardrail | Value | Notes |
|---|---|---|
| **Floor gross margin (setup)** | [X]% | Minimum margin on setup fee |
| **Floor gross margin (monthly)** | [X]% | Minimum margin on platform fee |
| **Maximum discount authority** | [X]% off list | Without executive approval |
| **Discount requiring exec approval** | >[X]% | Requires sign-off before quoting |
| **Minimum monthly deal size** | $[X]/mo | Floor — nothing below this |
| **Minimum setup deal size** | $[X] | Floor — nothing below this |
| **Enterprise exception path** | Custom SOW | Approved by [role] before issuing |
| **Exclusivity policy** | Not offered / limited to [terms] | To be defined |
| **Free trial policy** | Not offered | Platform licensing is not a trial product |

---

## Section 7: Validation Checklist

Before publishing any pricing to Stage 13, confirm:

- [ ] Cost model is completed with real hour estimates and COGS figures
- [ ] Ranges validated against at least 3 real deal archetypes (e.g., Amy, Cindy, Divvy)
- [ ] Floor margins reviewed and approved
- [ ] Guardrails set and documented above
- [ ] Minimum deal size confirmed for each tier
- [ ] Commercial policy reviewed (change order rules, overage, renewal)
- [ ] Stage 13 copy reviewed against final ranges — no sticker shock on either side
- [ ] Leadership sign-off on published ranges

---

## Section 8: Output — Stage 13 Public Ranges
*Populate after completing Sections 2–7. Do not publish before validation checklist is complete.*

### Independent Coach or Small Practice
**Typical Setup Investment:** $[X,XXX] – $[XX,XXX]
**Typical Monthly Platform Fee:** $[X,XXX] – $[X,XXX]/month

### Growing Organization
**Typical Setup Investment:** $[XX,XXX] – $[XXX,XXX]
**Typical Monthly Platform Fee:** $[X,XXX] – $[XX,XXX]/month

### Regional or National Organization
**Typical Setup Investment:** $[XXX,XXX]+
**Typical Monthly Platform Fee:** $[XX,XXX]+/month

### Enterprise Healthcare Deployment
**Setup Investment:** Custom scope
**Monthly Platform Fee:** Custom scope

---

### Pricing Disclosure Language (for Stage 13)
Once ranges are confirmed, use this language on the page:

> The ranges shown above reflect typical investments for each deployment tier based on standard scope, branding requirements, and user volume. Final pricing is determined after a discovery conversation and depends on your specific clinical scope, integrations, compliance requirements, deployment complexity, and support needs. Every project is individually scoped. Larger deployments, custom integrations, and enterprise requirements may exceed the ranges shown.

---

*Document maintained by: [Owner]*
*Last updated: June 9, 2026*
*Next review: After first 3 deals are closed and validated against this model*
