# Database Architecture

**Status:** FRAMEWORK — See `09_ARCHITECTURE/06_DATABASE_ARCHITECTURE.md` (Phase 6 APPROVED 2026-07-20)

## Purpose

Defines data domains, storage choices, consistency models, and retention rules that underpin accurate logistics state—the source of operational truth.

## Table of Contents

1. Data Principles
   1.1. Single source of truth per domain
   1.2. Auditability of state changes
   1.3. Privacy by design
2. Domain Data Map
   2.1. Identity & organisations
   2.2. Orders / jobs / shipments
   2.3. Tracking & events
   2.4. Fleet & drivers
   2.5. Billing & settlements
   2.6. Support & cases
   2.7. Analytics / warehouse
3. Storage Strategy
   3.1. Transactional stores
   3.2. Event / log stores
   3.3. Search & read models
   3.4. Object storage (POD, media)
   3.5. Warehouse / BI
4. Consistency & Integrity
   4.1. Strong vs eventual consistency by use case
   4.2. Idempotency
   4.3. Conflict handling
5. Lifecycle & Retention
   5.1. Retention by data class
   5.2. Archival to 08_ARCHIVE policies linkage
   5.3. Deletion / DSAR readiness
6. Performance & Scale
   6.1. Indexing strategy
   6.2. Partitioning / sharding criteria
   6.3. Hot path queries
7. Open Questions & Assumptions to Challenge
8. Approval & Revision History

---

*This chapter is a structural placeholder in the Project Atlas master handbook. Content will be written only after executive approval of this outline.*
