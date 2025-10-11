$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId
use llc.civictech.school#CatalogTaskInstructions
use llc.civictech.school#CatalogTaskName
use llc.civictech.school#CatalogTaskSubheading
use llc.civictech.school#TaskGradingMethod

/// Unique identifier for a partner studio registered with the CivicTech platform.
@length(min: 1, max: 64)
string PartnerId

/// Human-readable display name for the partner.
@length(min: 1, max: 120)
string PartnerName

/// A task entry within a partner's catalog.
structure TaskCatalogEntry {
    /// Partner-scoped identifier for the task.
    @required
    entryId: CatalogEntryId

    /// Display title for the catalog entry.
    @required
    name: CatalogTaskName

    /// Subtitle shown with the task to provide added context.
    @required
    subheading: CatalogTaskSubheading

    /// Instructions visible to educators and students.
    @required
    instructions: CatalogTaskInstructions

    /// Grading approach to use when evaluating student progress.
    @required
    gradingMethod: TaskGradingMethod
}

/// Catalog entries grouped by partner.
structure PartnerTaskCatalog {
    /// Unique identifier assigned to the partner.
    @required
    partnerId: PartnerId

    /// Human-readable display name for the partner.
    @required
    partnerName: PartnerName

    /// Tasks made available by this partner.
    @required
    catalogEntries: TaskCatalogEntries
}

list TaskCatalogEntries {
    member: TaskCatalogEntry
}

list PartnerTaskCatalogList {
    member: PartnerTaskCatalog
}

/// Retrieves the catalog of tasks exposed to classroom teachers.
@http(method: "GET", uri: "/task-catalog")
@handler(language: "typescript")
operation GetTaskCatalog {
    output := {
        /// Catalog groupings for every partner game studio.
        @required
        partners: PartnerTaskCatalogList
    }
    errors: [
        NotAuthorizedError
        InternalFailureError
    ]
}
