$version: "2"
namespace llc.civictech.school

use llc.civictech.school#CatalogEntryId
use llc.civictech.school#CatalogTaskInstructions
use llc.civictech.school#CatalogTaskName
use llc.civictech.school#CatalogTaskSubheading
use llc.civictech.school#Milestones
use llc.civictech.school#ExperienceId
use llc.civictech.school#AssetIds

/// A task entry within an experience's catalog.
structure TaskCatalogEntry {
    /// Experience-scoped identifier for the task.
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

    /// Optional assets that represent the task.
    assetIds: AssetIds

    /// Optional milestones providing partial grading breakdowns.
    milestones: Milestones
}

/// Catalog entries grouped by experience.
structure ExperienceTaskCatalog {
    /// Unique identifier assigned to the experience.
    @required
    experienceId: ExperienceId

    /// Human-readable display name for the experience.
    @required
    experienceName: ExperienceName

    /// Optional assets representing the experience.
    assetIds: AssetIds

    /// Tasks made available by this experience.
    @required
    catalogEntries: TaskCatalogEntries
}

list TaskCatalogEntries {
    member: TaskCatalogEntry
}

list ExperienceTaskCatalogList {
    member: ExperienceTaskCatalog
}

/// Retrieves the catalog of tasks exposed to classroom teachers.
@http(method: "GET", uri: "/task-catalog")
@handler(language: "typescript")
operation GetTaskCatalog {
    output := {
        /// Catalog groupings for every experience game studio.
        @required
        experiences: ExperienceTaskCatalogList
    }
    errors: [
        NotAuthorizedError
        InternalFailureError
    ]
}
