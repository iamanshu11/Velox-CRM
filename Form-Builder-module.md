I need you to build a complete Form Builder module for my CRM similar to HubSpot.

Tech Stack:

* Frontend: React
* Backend: Node.js + Express
* Database: PostgreSQL

Architecture:

Form Builder
↓
PostgreSQL (Store JSON Schema)
↓
Public Form Renderer
↓
Iframe + JavaScript Embed
↓
Submission API
↓
Lead Creation Engine
↓
CRM Pipeline

==================================================
PART 1: FORM BUILDER
====================

Create a drag-and-drop Form Builder where Admins can create forms.

Supported Field Types:

* Text Input
* Email
* Phone
* Textarea
* Dropdown
* Checkbox
* Radio Button
* Date Picker
* File Upload
* Hidden Field

Store forms as JSON schema in PostgreSQL.

Example:

{
"name": "Contact Form",
"fields": [
{
"type": "text",
"label": "Full Name",
"required": true
},
{
"type": "email",
"label": "Email",
"required": true
}
]
}

Database Table:

forms

* id
* name
* slug
* form_json
* status
* created_by
* created_at
* updated_at

==================================================
PART 2: PUBLIC FORM RENDERER
============================

Create public routes:

GET /public/forms/:formId

The renderer should:

* Fetch JSON schema
* Dynamically render fields
* Support validation
* Support responsive layouts

Create a public form page:

https://crm.domain.com/embed/:formId

==================================================
PART 3: EMBED OPTIONS
=====================

Generate iframe embed code:

<iframe
src="https://crm.domain.com/embed/form_123"
width="100%"
height="700"
frameborder="0">
</iframe>

Also create JavaScript Embed:

<div id="crm-form"></div>

<script src="https://crm.domain.com/form.js"></script>

<script>
CRMForm.render({
formId: "form_123",
target: "#crm-form"
});
</script>

==================================================
PART 4: FORM SUBMISSIONS
========================

Create API:

POST /public/forms/:formId/submit

Store submissions in:

form_submissions

* id
* form_id
* submission_data (JSONB)
* email
* ip_address
* user_agent
* time_taken_seconds
* spam_score
* status
* created_at

==================================================
PART 5: LEAD CREATION
=====================

After successful form submission:

1. Create Lead
2. Assign Source = Website Form
3. Link Lead to Form
4. Push Lead into CRM Pipeline

lead_sources:

* Website Form
* Landing Page
* Contact Form
* Affiliate Form

==================================================
PART 6: ANTI-SPAM PROTECTION
============================

Implement the following protections.

---

1. RATE LIMITING

---

Use express-rate-limit.

Rules:

* Maximum 10 submissions
* Per IP Address
* Every 15 minutes

Return proper error response.

---

2. EMAIL DOMAIN VALIDATION

---

Create table:

blocked_email_domains

* id
* domain
* created_at

Examples:

mailinator.com
10minutemail.com
guerrillamail.com
temp-mail.org

When email is submitted:

* Extract domain
* Check database
* Reject if domain exists

Create Admin CRUD:

GET /admin/email-domains
POST /admin/email-domains
DELETE /admin/email-domains/:id

Admins should manage blocked domains without code changes.

---

3. SUBMISSION TIME CHECK

---

Frontend should send:

formLoadedAt

Backend should calculate:

timeTakenSeconds

Rules:

Less than 3 seconds:

* Reject submission

Between 3 and 5 seconds:

* Mark suspicious

More than 5 seconds:

* Accept

Store:

time_taken_seconds

==================================================
PART 7: SPAM SCORING SYSTEM
===========================

Create a spam scoring engine.

Rules:

Submission under 3 seconds:
+30 points

Blocked Email Domain:
+50 points

Rate Limit Violations:
+20 points

Final Score:

0-30
Normal Lead

31-60
Review Lead

61+
Spam Lead

Store:

spam_score
lead_status

Lead Status:

NEW
REVIEW
SPAM
CONVERTED

==================================================
PART 8: ADMIN DASHBOARD
=======================

Create pages for:

* Form List
* Form Builder
* Form Analytics
* Form Submissions
* Spam Leads
* Blocked Domains

Analytics:

* Total Submissions
* Leads Created
* Spam Submissions
* Conversion Rate
* Top Forms

==================================================
PART 9: SECURITY
================

Use:

* Helmet
* Input Validation
* XSS Protection
* SQL Injection Protection
* CORS Configuration

==================================================
PART 10: DELIVERABLES
=====================

Provide:

* PostgreSQL schema
* Folder structure
* Backend APIs
* React components
* Middleware
* Services
* Controllers
* Routes
* Validation
* Complete implementation code

The solution should be production-ready, scalable, and similar to HubSpot's Form Builder architecture.
