# BRDT: Bulk Record Deletion Framework for NetSuite

A resilient, SuiteQL-powered architecture designed to handle massive data teardowns and complex transaction chain deletions with **0** system timeouts.

## The Business Problem
During NetSuite implementations, sandbox testing, or data migrations, clearing out test data is a notoriously slow, manual process. Deleting a transaction chain (like Order-to-Cash) usually results in dependency errors (e.g., "Cannot delete Invoice because a Customer Payment is applied"). Standard mass update tools or simple scripts fail due to governance limits and strict record dependencies.

## The Architectural Solution
BRDT bypasses standard UI limitations by combining a high-performance SuiteQL frontend with a recursive Map/Reduce backend engine. 

It doesn't just delete records; it analyzes transaction chains, handles dependency errors gracefully, and automatically re-queues itself to ensure complete data eradication.

### System Architecture Highlights:
* **Decoupled Architecture:** A sleek, custom UI (Suitelet) handles user interaction and SuiteQL data fetching, completely independent of the heavy lifting.
* **The "Nuclear" Recursion Engine:** For complex chains (O2C and P2P), the Map/Reduce script utilizes an intelligent 5-loop recursion mechanism. If a parent record fails to delete due to an existing child dependency, the script catches the error, deletes the child, and uses `N/task` to automatically trigger the next loop to clean up the newly orphaned parent.
* **SuiteQL Optimization:** Replaces slow standard Saved Searches with direct `N/query` SQL execution, pulling thousands of records in milliseconds for UI rendering and backend batching.
* **Governance Immunity:** By distributing the deletion payload across Map/Reduce queues and utilizing self-triggering tasks, the tool scales infinitely without hitting NetSuite's strict execution time limits.

## Core Features
* **☢️ The Nuclear Option:** Instantly wipe entire Procure-to-Pay (P2P) or Order-to-Cash (O2C) transaction chains. The script knows the exact hierarchy and table structures to target.
* **Custom UI Engine:** Bypasses the native NetSuite DOM to inject a lightweight, responsive interface using Vanilla JS and CSS, providing real-time visual feedback and selection marquees.
* **Unhindered Extensibility:** Dynamically queries `customrecordtype` tables on load, allowing users to delete proprietary custom records without needing to update the script.
* **Automated Auditing:** Dispatches end-of-process email summaries detailing success counts, failure reasons, and recursion loop metrics via the `summarize` phase.

## Technical Stack & Modules Used
* **SuiteScript 2.1:** Modern syntax, utilizing arrow functions, promises, and optimized array methods.
* **Modules:** `N/query`, `N/task`, `N/record`, `N/ui/serverWidget`, `N/log`.
* **Integration:** REST-like JSON payload handling between the Suitelet frontend and the Map/Reduce backend.

## Deployment Instructions
1.  Deploy `bulk-records-delete-tool-mr.js` as an unreleased Map/Reduce script (`customscript_bulk_delete_tool_mr`).
2.  Deploy `bulk-records-delete-tool-sl.js` as a Suitelet.
3.  Access the Suitelet URL to launch the UI.

> **Note:** This tool is inherently destructive and designed for Sandbox/Development environments. Use the Nuclear Option with extreme caution.
