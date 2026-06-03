# CRM User Verification, Document Management & Account Activation Enhancement

## Overview

Enhance the existing CRM onboarding and verification process while maintaining the current role hierarchy and permissions.

### Role Hierarchy

* Super Admin can create:

  * Admins( Doesn't need to upload the documents, their accounts are already ative)
  * Employees
  * Agents
  * Affiliates

* Admin can create:

  * Employees
  * Agents
  * Affiliates

All newly created users can log in immediately but must complete document verification before receiving full portal access.

---

## User Onboarding & Verification Flow

1. Super Admin or Admin creates a new account.
2. Login credentials are sent to the user.
3. User logs into the portal.
4. User is redirected to the Verification Dashboard.
5. User uploads all required verification documents.
6. Documents are submitted for review.
7. Admin or Super Admin reviews each document individually.
8. Documents can be:

   * Pending
   * Under Review
   * Approved
   * Rejected
9. Reviewer can add comments when rejecting a document.
10. User receives real-time status updates.
11. Once all mandatory documents are approved, the account can be activated.
12. Activated users receive full CRM access.

---

## Required Documents

### Employee

* Passport
* Driving License
* Proof of Address
* Experience Letter
* Police Verification Certificate

### Agent

## Must upload:

* Company/Business Registration Documents
* Trade License
* Incorporation Certificate
* Tax Certificate
* Business Address Proof
* Business Bank Account Details
* Bank Statements
* Passport
* Driving License
* Proof of Address

#### Business Documents

* Business Registration Certificate
* Trade License
* Incorporation Certificate
* Tax Certificate
* Business Address Proof
* Business Bank Account Details
* Business Bank Statements

### Affiliate

## Must upload:

* Passport
* Driving License
* Proof of Address
* Bank Account Details
* Business Account Details (if registered as a business entity)

---

# Document Management System

## Supported Formats

* PDF
* JPG
* JPEG
* PNG

Maximum File Size:

* 10 MB per file

Preferred Format:

* PDF

---

## Storage Strategy

Documents should NOT be stored directly inside PostgreSQL.

Store files in:

* AWS S3 (Preferred)
* Azure Blob Storage
* Google Cloud Storage
* Local Storage (Development Only)

Database should store:

* File Name
* Original File Name
* Storage Path
* File URL
* MIME Type
* File Size
* Upload Date

This improves scalability and performance.

---

# Admin & Super Admin Review Portal

## Verification Management Screen

Filters:

* Employees
* Agents
* Affiliates

Status Filters:

* Pending
* Under Review
* Approved
* Rejected
* Activated

Search:

* Name
* Email
* User ID

---

# User Dashboard

Users should see:

### Verification Progress

Example:

```text
Documents Uploaded: 7/10

Verification Status:
Under Review
```

### Document Status Table

| Document        | Status   |
| --------------- | -------- |
| Passport        | Approved |
| Driving License | Pending  |
| Tax Certificate | Rejected |

### Activity Timeline

* Document Uploaded
* Document Reviewed
* Document Approved
* Account Activated

---

# Account Activation

Only Super Admin and Admin can:

* Activate Account
* Suspend Account
* Reject Verification

Activation button should only appear when all required documents are approved.

---

# Automatic Account Removal

If verification is not completed within 7 days:

1. User account becomes expired.
2. Uploaded documents are removed.
3. Related verification records are archived.
4. User can no longer log in.

Implement using:

* Cron Job
* Scheduled Worker
* Background Queue

Run daily.

---

# Notifications

Send notifications for:

* Document Uploaded
* Document Approved
* Document Rejected
* Re-upload Required
* Account Activated
* Account Expiring in 24 Hours
* Account Removed

Notification Channels:

* In-App Notifications
* Email Notifications

---

# Audit Logging

Track every action:

* Account Created
* Document Uploaded
* Document Deleted
* Document Approved
* Document Rejected
* Verification Completed
* Account Activated
* Account Removed

Store:

* User
* Action
* Timestamp
* IP Address
* Role
* Metadata

---

# Final Goal

Create a complete KYC-style verification and account activation system where Employees, Agents, and Affiliates must upload role-specific documents, Admins and Super Admins can review and manage documents through a dedicated verification portal, users can track verification progress in real time, documents are securely stored as PDFs/files, and unverified accounts are automatically removed after 7 days.
